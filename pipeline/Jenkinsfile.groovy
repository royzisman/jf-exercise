pipeline {
    environment {
        imageName = "etingertal/jf-exercise"
        registryCredential = 'etingertal-dockerhub'
        dockerImage = ''
    }
    agent any
    tools {
        maven 'Maven 3.3.9'
        jdk 'jdk-11'
    }
    stages {
        stage ('init') {

            steps {
                script {
                    def pom = readMavenPom file: 'pom.xml'
                    env.PATH = "${env.PATH}:/usr/local/bin/" // Ensure docker inside there

                    echo "ARTIFACT_ID=${pom.artifactId}"
                    echo "PATH = ${PATH}"
                    echo "M2_HOME = ${M2_HOME}"
                }
            }
        }

        stage ('compile') {
            steps {
                sh 'mvn -DskipTests package' // Using package for later use by docker
            }
        }

        stage ('test') {
            steps {
                sh 'mvn -Dmaven.test.failure.ignore=true test'
            }
            post {
                success {
                    junit 'target/surefire-reports/**/*.xml'
                }
            }
        }

        stage ('build docker image') {
            steps {
                script {
                    dockerImage = docker.build imageName
                }
            }
        }

        stage ('push docker image') {
            steps {
                script {
                    docker.withRegistry('', registryCredential) {
                        dockerImage.push("${BUILD_NUMBER}")
                        dockerImage.push('latest')
                    }
                }
            }
        }
    }
}
