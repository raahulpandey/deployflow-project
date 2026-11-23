output "container_id" {
  description = "Provisioned Docker container ID"
  value       = docker_container.deployflow_server.id
}

output "container_ip" {
  description = "Internal bridge IP address monitored by Nagios"
  value       = docker_container.deployflow_server.network_data[0].ip_address
}

output "control_plane_url" {
  description = "DeployFlow v2.0 Control Plane URL"
  value       = "http://localhost:${var.external_port}"
}
