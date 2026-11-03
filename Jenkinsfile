// ORIN — CI/CD: build -> SAST -> dependency scan -> image scan -> DAST -> push -> GitOps
// Tools (node, trivy, zap, curl) run as Docker containers, so the Jenkins agent
// only needs Docker CLI access plus the SonarQube Scanner tool.

def nodeRun(String cmd) {
    sh """
      docker run --rm -u \$(id -u):\$(id -g) -e HOME=/tmp -e npm_config_cache=/tmp/.npm \
        ${env.DOCKER_VOL} -w ${env.WORKSPACE} ${env.NODE_IMAGE} sh -c '${cmd}'
    """
}

def trivy(String args) {
    sh """
      docker run --rm -u \$(id -u):\$(id -g) --group-add \$(stat -c %g /var/run/docker.sock) \
        -v /var/run/docker.sock:/var/run/docker.sock ${env.DOCKER_VOL} -w ${env.WORKSPACE} \
        -e HOME=/tmp -e TRIVY_CACHE_DIR=${env.WORKSPACE}/.trivycache \
        ${env.TRIVY_IMAGE} ${args}
    """
}

pipeline {
    agent any

    options {
        buildDiscarder(logRotator(numToKeepStr: '10'))
        disableConcurrentBuilds()
        timeout(time: 60, unit: 'MINUTES')
    }

    environment {
        // ---- change these to match your Jenkins setup ----
        DOCKERHUB_USER   = 'vishnumadhu13'
        DOCKERHUB_CREDS  = 'docker-cred'      // Username/Password (Docker Hub access token)
        GIT_CREDS        = 'github-jenkins'       // Username/Password (GitHub PAT)
        GIT_REPO         = 'github.com/VishnuMadhu13/ORIN.git'
        GIT_BRANCH_NAME  = 'main'
        SONAR_SERVER     = 'sonarqube'            // Manage Jenkins > System > SonarQube servers
        SONAR_SCANNER    = 'sonar-scanner'        // Manage Jenkins > Tools > SonarQube Scanner
        // ---------------------------------------------------
        SERVER_IMAGE = "${DOCKERHUB_USER}/orin-server"
        CLIENT_IMAGE = "${DOCKERHUB_USER}/orin-client"
        IMAGE_TAG    = "${BUILD_NUMBER}"
        REPORTS      = 'reports'
        DAST_NET     = "orin-dast-${BUILD_NUMBER}"
        NODE_IMAGE   = 'node:22.14.0-alpine'
        TRIVY_IMAGE  = 'aquasec/trivy:0.58.1'
        ZAP_IMAGE    = 'ghcr.io/zaproxy/zaproxy:2.15.0'
        CURL_IMAGE   = 'curlimages/curl:8.11.1'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
                script {
                    def msg = sh(script: 'git log -1 --pretty=%B', returnStdout: true).trim()
                    env.SKIP_PIPELINE = msg.contains('[skip ci]') ? 'true' : 'false'
                    if (env.SKIP_PIPELINE == 'true') {
                        echo 'GitOps manifest commit detected ([skip ci]) - skipping pipeline.'
                        currentBuild.result = 'NOT_BUILT'
                    }
                    // Containers started from Jenkins must see the same workspace path.
                    // Jenkins in Docker: share its volumes. Jenkins on host: bind-mount.
                    env.DOCKER_VOL = sh(
                        script: 'if [ -f /.dockerenv ]; then echo "--volumes-from $(hostname)"; else echo "-v $WORKSPACE:$WORKSPACE"; fi',
                        returnStdout: true
                    ).trim()
                }
                sh 'rm -rf reports && mkdir -p reports/zap'
            }
        }

        stage('CI/CD') {
            when { expression { env.SKIP_PIPELINE != 'true' } }
            stages {
                stage('Install Dependencies') {
                    steps {
                        nodeRun('npm ci && npm ci --prefix server && npm ci --prefix client')
                    }
                }

                stage('Typecheck & Build') {
                    steps {
                        nodeRun('npm run typecheck && npm run build')
                    }
                }

                stage('SAST - SonarQube') {
                    steps {
                        script {
                            def scannerHome = tool env.SONAR_SCANNER
                            withSonarQubeEnv(env.SONAR_SERVER) {
                                sh "${scannerHome}/bin/sonar-scanner -Dsonar.projectVersion=${BUILD_NUMBER}"
                            }
                        }
                    }
                }

                stage('Quality Gate') {
                    steps {
                        timeout(time: 10, unit: 'MINUTES') {
                            script {
                                def qg = waitForQualityGate()
                                if (qg.status != 'OK') {
                                    unstable("SonarQube quality gate: ${qg.status}")
                                }
                            }
                        }
                    }
                }

                stage('Dependency Scan') {
                    steps {
                        // npm audit (production deps only) - report, do not fail
                        nodeRun('npm audit --prefix server --omit=dev > reports/npm-audit-server.txt || true; ' +
                                'npm audit --prefix client --omit=dev > reports/npm-audit-client.txt || true; ' +
                                'npm audit --prefix server --omit=dev --json > reports/npm-audit-server.json || true; ' +
                                'npm audit --prefix client --omit=dev --json > reports/npm-audit-client.json || true')
                        // Trivy filesystem: lockfile CVEs, leaked secrets, Dockerfile/K8s misconfig
                        trivy("fs --scanners vuln,secret,misconfig --severity HIGH,CRITICAL " +
                              "--skip-dirs '**/node_modules' --skip-dirs .trivycache --skip-dirs reports " +
                              "--format table --output reports/trivy-fs.txt --exit-code 0 .")
                    }
                }

                stage('Build Images') {
                    steps {
                        sh '''
                          docker build -t ${SERVER_IMAGE}:${IMAGE_TAG} -t ${SERVER_IMAGE}:latest ./server
                          docker build -t ${CLIENT_IMAGE}:${IMAGE_TAG} -t ${CLIENT_IMAGE}:latest ./client
                        '''
                    }
                }

                stage('Image Scan - Trivy') {
                    steps {
                        trivy("image --severity HIGH,CRITICAL --ignore-unfixed --format table " +
                              "--output reports/trivy-image-server.txt --exit-code 0 ${SERVER_IMAGE}:${IMAGE_TAG}")
                        trivy("image --severity HIGH,CRITICAL --ignore-unfixed --format table " +
                              "--output reports/trivy-image-client.txt --exit-code 0 ${CLIENT_IMAGE}:${IMAGE_TAG}")
                    }
                }

                stage('DAST - OWASP ZAP') {
                    steps {
                        sh """
                          docker network create ${DAST_NET}

                          docker run -d --name ${DAST_NET}-mongo --network ${DAST_NET} --network-alias mongo mongo:6.0

                          docker run -d --name ${DAST_NET}-server --network ${DAST_NET} --network-alias orin-server \\
                            -e NODE_ENV=production -e PORT=5000 \\
                            -e MONGODB_URI=mongodb://mongo:27017/orin \\
                            -e JWT_SECRET=dast-throwaway-secret-${BUILD_TAG}-not-for-production \\
                            -e CLIENT_URL=http://orin-client:8080 -e COOKIE_SECURE=false \\
                            ${SERVER_IMAGE}:${IMAGE_TAG}

                          docker run --rm --network ${DAST_NET} ${CURL_IMAGE} -s -o /dev/null \\
                            --retry 30 --retry-delay 2 --retry-all-errors http://orin-server:5000/

                          docker run -d --name ${DAST_NET}-client --network ${DAST_NET} --network-alias orin-client \\
                            ${CLIENT_IMAGE}:${IMAGE_TAG}

                          docker run --rm --network ${DAST_NET} ${CURL_IMAGE} -sf -o /dev/null \\
                            --retry 15 --retry-delay 2 --retry-all-errors http://orin-client:8080/

                          # ZAP needs a writable /zap/wrk: use a named volume, then docker cp the reports out
                          docker volume create ${DAST_NET}-zap
                          docker run --rm -v ${DAST_NET}-zap:/zap/wrk busybox:1.36.1 chmod 777 /zap/wrk

                          docker run --name ${DAST_NET}-zap --network ${DAST_NET} -v ${DAST_NET}-zap:/zap/wrk \\
                            ${ZAP_IMAGE} zap-baseline.py -t http://orin-client:8080 \\
                            -r zap-report.html -J zap-report.json -w zap-report.md -I || true

                          docker cp ${DAST_NET}-zap:/zap/wrk/. ${REPORTS}/zap/
                        """
                    }
                    post {
                        always {
                            sh """
                              docker rm -f ${DAST_NET}-zap ${DAST_NET}-client ${DAST_NET}-server ${DAST_NET}-mongo || true
                              docker volume rm ${DAST_NET}-zap || true
                              docker network rm ${DAST_NET} || true
                            """
                        }
                    }
                }

                stage('Push Images') {
                    steps {
                        withCredentials([usernamePassword(credentialsId: env.DOCKERHUB_CREDS,
                                usernameVariable: 'DH_USER', passwordVariable: 'DH_PASS')]) {
                            sh '''
                              echo "$DH_PASS" | docker login -u "$DH_USER" --password-stdin
                              docker push ${SERVER_IMAGE}:${IMAGE_TAG}
                              docker push ${SERVER_IMAGE}:latest
                              docker push ${CLIENT_IMAGE}:${IMAGE_TAG}
                              docker push ${CLIENT_IMAGE}:latest
                              docker logout
                            '''
                        }
                    }
                }

                stage('Update K8s Manifests (GitOps)') {
                    steps {
                        withCredentials([usernamePassword(credentialsId: env.GIT_CREDS,
                                usernameVariable: 'GIT_USER', passwordVariable: 'GIT_TOKEN')]) {
                            sh '''
                              git config user.email "jenkins@orin.local"
                              git config user.name "Jenkins CI"
                              git fetch origin ${GIT_BRANCH_NAME}
                              git checkout -B ${GIT_BRANCH_NAME} origin/${GIT_BRANCH_NAME}

                              sed -i -E "s|(newTag: ).*|\\1\\"${IMAGE_TAG}\\"|" k8s/kustomization.yaml
                              grep -n "newTag" k8s/kustomization.yaml

                              git add k8s/kustomization.yaml
                              if git diff --cached --quiet; then
                                echo "Manifests already at ${IMAGE_TAG}"
                                exit 0
                              fi
                              git commit -m "ci: deploy orin ${IMAGE_TAG} [skip ci]"
                              git push "https://${GIT_USER}:${GIT_TOKEN}@${GIT_REPO}" HEAD:${GIT_BRANCH_NAME}
                            '''
                        }
                    }
                }
            }
        }
    }

    post {
        always {
            script {
                if (env.SKIP_PIPELINE != 'true') {
                    // Single consolidated security report
                    sh '''
                      {
                        echo "ORIN security report - build ${BUILD_NUMBER} - $(date -u '+%Y-%m-%d %H:%M UTC')"
                        echo "SAST: SonarQube project 'orin' (see SonarQube dashboard / build page link)"
                        for f in npm-audit-server.txt npm-audit-client.txt trivy-fs.txt \
                                 trivy-image-server.txt trivy-image-client.txt zap/zap-report.md; do
                          echo
                          echo "==================== ${f} ===================="
                          cat "reports/${f}" 2>/dev/null || echo "(not generated)"
                        done
                      } > reports/security-report.txt
                    '''
                }
            }
            archiveArtifacts artifacts: 'reports/**', allowEmptyArchive: true
            sh 'docker image prune -f || true'
        }
        success {
            echo "ORIN ${IMAGE_TAG} built, scanned, pushed; ArgoCD will sync k8s/ automatically."
        }
        unstable {
            echo 'Pipeline UNSTABLE - check the quality gate and reports/security-report.txt'
        }
        failure {
            echo 'Pipeline FAILED - check the stage logs above.'
        }
    }
}
