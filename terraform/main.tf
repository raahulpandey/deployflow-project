terraform {
  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = "~> 3.0"
    }
  }
}

provider "docker" {}

# Pull the official Ubuntu 22.04 image
resource "docker_image" "ubuntu" {
  name         = "ubuntu:22.04"
  keep_locally = true
}

# Create and start the container server
resource "docker_container" "app_server" {
  image = docker_image.ubuntu.image_id
  name  = "deployflow-server"

  # Keep the container running in the background
  command = ["tail", "-f", "/dev/null"]

  ports {
    internal = 3000
    external = 3000
  }
}