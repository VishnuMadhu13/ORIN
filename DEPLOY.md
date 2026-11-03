# ORIN — CI/CD runbook

## File layout (copy into the repo root)

```
ORIN/
├── Jenkinsfile
├── sonar-project.properties
├── docker-compose.yml
├── server/Dockerfile, server/.dockerignore
├── client/Dockerfile, client/.dockerignore, client/nginx.conf
├── k8s/          namespace, configmap, mongo, server, client, kustomization, secret.example
├── argocd/       application.yaml
└── monitoring/   Prometheus/Grafana values, Loki values, ServiceMonitor, alert rules, metrics.ts
```

## 0. Verify assumptions before the first build

```bash
# Server: build script + compiled entry point (Dockerfile runs node dist/index.js)
grep -A8 '"scripts"' server/package.json
grep -E '"(outDir|rootDir)"' server/tsconfig.json
npm run build --prefix server && ls server/dist

# Client: build output must be client/dist; proxied paths must match nginx.conf
grep -A12 "proxy" client/vite.config.ts

# npm ci needs lockfiles in all three places
ls package-lock.json server/package-lock.json client/package-lock.json
```

- If the entry point is e.g. `dist/src/index.js`, change the last line of `server/Dockerfile`.
- If the Vite proxy uses paths other than `/api`, `/uploads`, `/socket.io`, mirror them in `client/nginx.conf`.
- A missing lockfile: run `npm install` (or `--prefix server/client`) and commit the generated `package-lock.json`.

## 1. Test the containers locally (macOS)

```bash
docker compose up --build        # JWT_SECRET is read from the root .env
open http://localhost:8088
docker compose logs -f orin-server
docker compose down              # add -v to wipe Mongo and uploads
```

Port 5000 is intentionally not published (AirPlay Receiver).

## 2. Jenkins

Credentials (Manage Jenkins > Credentials):
- `dockerhub-creds` — Username/Password: `vishnumadhu13` + Docker Hub access token
- `github-jenkins` — Username/Password: GitHub username + PAT with repo scope
- SonarQube token — referenced by the SonarQube server entry

Configuration:
- Manage Jenkins > System > SonarQube servers: name `sonarqube`
- Manage Jenkins > Tools > SonarQube Scanner: name `sonar-scanner` (install automatically)
- SonarQube > Administration > Webhooks: `http://<jenkins-host>:8080/sonarqube-webhook/`
- The Jenkins user must be able to run `docker` (socket mounted when Jenkins runs in Docker)
- Pipeline job > Pipeline script from SCM > repo `https://github.com/VishnuMadhu13/ORIN.git`, branch `main`, credential `github-jenkins`, script path `Jenkinsfile`

Archived artifacts per build: `reports/security-report.txt` (all scans in one file) plus the
raw npm-audit, Trivy and ZAP (html/json/md) reports.

GitOps commits contain `[skip ci]`; the pipeline detects them and stops, so a webhook does not loop.

Architecture: images are built for the Jenkins host's CPU. Jenkins on an amd64 EC2 host with
Minikube on an Apple Silicon Mac gives `exec format error`. Either run Jenkins where the cluster
runs, or switch the build to `docker buildx build --platform linux/amd64,linux/arm64 --push`.

## 3. Minikube + ArgoCD

```bash
minikube start --cpus 4 --memory 6144
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
kubectl -n argocd rollout status deploy/argocd-server

# App secret (once per cluster - never commit it)
kubectl create namespace orin
kubectl -n orin create secret generic orin-secrets \
  --from-literal=JWT_SECRET="$(openssl rand -hex 64)" \
  --from-literal=MONGODB_URI="mongodb://orin-mongo:27017/orin"

kubectl apply -f argocd/application.yaml

# ArgoCD UI (user admin)
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d; echo
kubectl -n argocd port-forward svc/argocd-server 8443:443     # https://localhost:8443

# ORIN (matches CLIENT_URL in k8s/configmap.yaml)
kubectl -n orin get pods
kubectl -n orin port-forward svc/orin-client 8088:80          # http://localhost:8088
```

## 4. Monitoring (Prometheus + Grafana) and logging (Loki + Promtail)

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update

helm upgrade --install loki grafana/loki-stack -n logging --create-namespace \
  -f monitoring/loki-stack-values.yaml
helm upgrade --install kube-prom prometheus-community/kube-prometheus-stack \
  -n monitoring --create-namespace -f monitoring/kube-prometheus-stack-values.yaml

kubectl apply -f monitoring/prometheus-rules.yaml
kubectl apply -f monitoring/servicemonitor.yaml    # after wiring metrics.ts into the server

kubectl -n monitoring port-forward svc/kube-prom-grafana 3000:80       # http://localhost:3000
kubectl -n monitoring port-forward svc/kube-prom-kube-prometheus-prometheus 9090:9090
```

Grafana (admin / password from the values file):
- Dashboards > Kubernetes / Compute Resources / Namespace (Pods) > namespace `orin`
- Explore > Loki > `{namespace="orin", app_kubernetes_io_name="orin-server"}`
- Import dashboard ID 11159 (Node.js) for the `orin_` process metrics
- Prometheus > Status > Targets should list `serviceMonitor/orin/orin-server` as UP

App metrics: copy `monitoring/metrics.ts` to `server/src/metrics.ts`, run
`npm install prom-client --prefix server`, and follow the wiring comments at the top of the file.
