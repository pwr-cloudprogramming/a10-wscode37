terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }
  required_version = ">= 1.2.0"
}

provider "aws" {
  region = "us-east-1"
}

resource "aws_cognito_user_pool" "main" {
  name                     = "example-user-pool"
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]
  #   mfa_configuration   = "OPTIONAL"

  password_policy {
    minimum_length                   = 8
    require_uppercase                = true
    require_lowercase                = true
    require_numbers                  = true
    require_symbols                  = true
    temporary_password_validity_days = 7
  }

  verification_message_template {
    default_email_option = "CONFIRM_WITH_CODE"
    email_message        = "Your verification code is {####}."
    email_subject        = "Verify your email address"
  }

  admin_create_user_config {
    allow_admin_create_user_only = false
  }

  schema {
    attribute_data_type      = "String"
    developer_only_attribute = false
    name                     = "email"
    required                 = true
    mutable                  = true

    string_attribute_constraints {
      min_length = 1
      max_length = 256
    }
  }
}

resource "aws_cognito_user_pool_client" "main" {
  name = "example-user-pool-client"

  user_pool_id           = aws_cognito_user_pool.main.id
  generate_secret        = false
  refresh_token_validity = 90
  explicit_auth_flows    = ["ALLOW_USER_PASSWORD_AUTH", "ALLOW_REFRESH_TOKEN_AUTH"]

  prevent_user_existence_errors = "ENABLED"
}


# Create VPC
resource "aws_vpc" "my_vpc" {
  cidr_block = "10.0.0.0/16"
}

# Create subnet
resource "aws_subnet" "my_subnet" {
  vpc_id     = aws_vpc.my_vpc.id
  cidr_block = "10.0.1.0/24"
}

# Create internet gateway
resource "aws_internet_gateway" "my_igw" {
  vpc_id = aws_vpc.my_vpc.id
}

# Create route table
resource "aws_route_table" "my_route_table" {
  vpc_id = aws_vpc.my_vpc.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.my_igw.id
  }
}

# Associate subnet with route table
resource "aws_route_table_association" "my_subnet_association" {
  subnet_id      = aws_subnet.my_subnet.id
  route_table_id = aws_route_table.my_route_table.id
}

# Create security group
resource "aws_security_group" "my_security_group" {
  name        = "my-security-group"
  description = "Allow SSH, HTTP, and custom TicTacToe ports"
  vpc_id      = aws_vpc.my_vpc.id

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 8080
    to_port     = 8080
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 8081
    to_port     = 8081
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_instance" "my_instance" {
  ami                         = "ami-080e1f13689e07408"
  instance_type               = "t2.small"
  key_name                    = "vockey"
  subnet_id                   = aws_subnet.my_subnet.id
  vpc_security_group_ids      = [aws_security_group.my_security_group.id]
  associate_public_ip_address = true
  user_data                   = <<-EOF
              #!/bin/bash
              LOGFILE=/var/log/user-data.log
              exec > >(tee -a $${LOGFILE} | logger -t user-data -s 2>/dev/console) 2>&1
              
              echo "Starting user data script..."

              set -euo pipefail

              function error_exit {
                echo "Error on line $${1}"
                exit 1
              }

              trap 'error_exit $${LINENO}' ERR

              echo "Changing directory to /home/ubuntu"
              cd /home/ubuntu

              echo "Updating package list"
              apt-get update -y

              echo "Installing prerequisites"
              apt-get install -y apt-transport-https ca-certificates curl software-properties-common

              echo "Adding Docker’s official GPG key"
              curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

              echo "Setting up Docker stable repository"
              echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

              echo "Updating package list again"
              apt-get update -y

              echo "Installing Docker"
              apt-get install -y docker-ce docker-ce-cli containerd.io

              echo "Creating Docker CLI plugins directory"
              mkdir -p /usr/local/lib/docker/cli-plugins

              echo "Downloading Docker Compose"
              curl -sL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-$(uname -m) -o /usr/local/lib/docker/cli-plugins/docker-compose

              echo "Setting permissions for Docker Compose"
              chown root:root /usr/local/lib/docker/cli-plugins/docker-compose
              chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

              echo "Installing JDK"
              apt-get install -y default-jdk

              echo "Updating package list again"
              apt-get update -y

              echo "Installing Maven"
              apt-get install -y maven

              echo "Cloning Git repository"
              git clone -b main https://github.com/pwr-cloudprogramming/a10-wscode37.git

              echo "Building Maven project"
              cd a10-wscode37/backend
              mvn package
              cd ../..

              echo "Changing IP in file"
              # Retrieve IP address using metadata script
              API_URL="http://169.254.169.254/latest/api"
              TOKEN=$(curl -X PUT "$${API_URL}/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 600")
              TOKEN_HEADER="X-aws-ec2-metadata-token: $${TOKEN}"
              METADATA_URL="http://169.254.169.254/latest/meta-data"
              IP_V4=$(curl -H "$${TOKEN_HEADER}" -s $${METADATA_URL}/public-ipv4)

              # Replace IP address and URL in JavaScript file
              JS_FILE="a10-wscode37/frontend/src/play.js"  # Update with the path to your JavaScript file

              echo "Replacing localhost with IP address in $${JS_FILE}"
              sed -i "s@localhost@$${IP_V4}@g" "$${JS_FILE}"
              echo "IP address replaced in $${JS_FILE}"

              echo "Updating config.json"
              REGION="${data.aws_region.current.name}"
              USERPOOLID="${aws_cognito_user_pool.main.id}"
              CLIENTID="${aws_cognito_user_pool_client.main.id}"

              # Path to the config.json file
              CONFIG_FILE="a10-wscode37/frontend/src/config.json"

              # Use sed to update values in config.json
              sed -i "s@\"region\": \"[^\"]*\"@\"region\": \"$${REGION}\"@g" "$${CONFIG_FILE}"
              sed -i "s@\"userPoolId\": \"[^\"]*\"@\"userPoolId\": \"$${USERPOOLID}\"@g" "$${CONFIG_FILE}"
              sed -i "s@\"clientId\": \"[^\"]*\"@\"clientId\": \"$${CLIENTID}\"@g" "$${CONFIG_FILE}"

              echo "Building Docker images"
              cd a10-wscode37/frontend
              docker build -t frontend:v1 -t frontend:latest .
              cd ../backend
              docker build -t backend:v1 -t backend:latest .
              cd ..

              echo "Starting Docker Compose"
              docker compose up -d

              echo "User data script completed"
              EOF

  tags = {
    Name = "Tic-tac-toe-Webserver3"
  }
}

output "user_pool_id" {
  value = aws_cognito_user_pool.main.id
}

output "client_id" {
  value = aws_cognito_user_pool_client.main.id
}

data "aws_region" "current" {}
