terraform {
  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = "~> 3.0.2"
    }
  }
}

provider "docker" {}

resource "docker_image" "ubuntu" {
  name         = var.base_image
  keep_locally = true
}

resource "docker_container" "deployflow_server" {
  name    = var.container_name
  image   = docker_image.ubuntu.image_id
  command = ["tail", "-f", "/dev/null"]
  restart = "unless-stopped"

  ports {
    internal = 3000
    external = var.external_port
  }

  labels {
    label = "project"
    value = "deployflow"
  }

  labels {
    label = "environment"
    value = var.environment
  }

  labels {
    label = "managed_by"
    value = "terraform"
  }
}
