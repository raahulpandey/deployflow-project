# DeployFlow — Enterprise Ops & Automated Deployment Console

End-to-end DevOps automation and observability project provisioning isolated container infrastructure with **Terraform**, configuring and deploying a **Node.js / Express** telemetry console via **Ansible**, and monitoring live HTTP health probes with **Nagios Core 4**.

## Architecture

- **Provisioning (`terraform/main.tf`):** Provisions `deployflow-server` (`ubuntu:22.04`) on Docker `bridge` (`172.17.0.2`) with port `3000` exposed.
- **Configuration (`ansible/playbook.yml`):** Connects via `ansible_connection=docker`, installs Node.js/npm, and runs the Express backend in the background.
- **Observability (`nagios/deployflow.cfg`):** Runs continuous `check_http` probes against `172.17.0.2:3000` and `/api/health` via Nagios Core 4 (`http://localhost:8081`).

## Project Structure

```text
deployflow-project/
├── app/            # Node.js Express API & Ops Console UI (port 3000)
├── terraform/      # Docker IaC container provisioning (main.tf)
├── ansible/        # Agentless inventory & deployment playbook
├── nagios/         # Nagios Core 4 host & HTTP service checks
└── readme.md
```

## Quick Start

1. **Provision Container:** `cd terraform && terraform init && terraform apply -auto-approve && cd ..`
2. **Deploy App:** `ansible-playbook -i ansible/inventory.ini ansible/playbook.yml`
3. **Access Dashboards:**
   - **DeployFlow Portal:** `http://localhost:3000`
   - **Nagios Dashboard:** `http://localhost:8081` (`nagiosadmin` / `nagios`)
