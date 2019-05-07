#!/bin/sh

sleep 2m

yum update all >/dev/null 2>&1

yum -y install java-1.8.0 >/dev/null 2>&1  && sudo yum -y remove java-1.7.0-openjdk >/dev/null 2>&1

wget -O /etc/yum.repos.d/jenkins.repo http://pkg.jenkins-ci.org/redhat/jenkins.repo

rpm --import http://pkg.jenkins-ci.org/redhat/jenkins-ci.org.key

yum -y install jenkins >/dev/null 2>&1

service jenkins start

chkconfig --add jerkins

cd /var/lib

aws s3 cp s3://theasia-backups/jenkins.tar.gz  jenkins.tar.gz

tar -xvzf jenkins.tar.gz >/dev/null 2>&1

service jenkins restart

yum -y install nginx

sudo amazon-linux-extras install nginx1.12

service nginx start

aws s3 cp s3://theasia-backups/jenkins.conf /etc/nginx/conf.d/

service nginx restart

