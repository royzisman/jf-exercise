pipeline {
    agent any
    tools {
        maven 'mvn-3.6.3'
        jdk 'jdk-11'
        docker 'docker'
    }
    stages {
        stage ('init') {

            steps {
                script {
                    def pom = readMavenPom file: 'pom.xml'
                    env.ARTIFACT = pom.artifactId // Needs Jenkins admin approval
                }
                sh '''
                    echo "ARTIFACT_ID=${ARTIFACT}"
                    echo "PATH = ${PATH}"
                    echo "M2_HOME = ${M2_HOME}"
                '''
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
                sh 'docker build -t etingertal/jf-exercise .'
            }
        }

        stage ('push docker image') {
            steps {
                sh 'docker push etingertal/jf-exercise'
            }
        }
    }
}
