variable "base_image" {
  description = "Base Linux container image for DeployFlow"
  type        = string
  default     = "ubuntu:22.04"
}

variable "container_name" {
  description = "Name of the managed DeployFlow container"
  type        = string
  default     = "deployflow-server"
}

variable "external_port" {
  description = "Host port mapped to the DeployFlow control plane"
  type        = number
  default     = 3000
}

variable "environment" {
  description = "Deployment environment tag"
  type        = string
  default     = "production"
}
