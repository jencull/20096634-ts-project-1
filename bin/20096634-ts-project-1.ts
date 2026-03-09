#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
// called ProjectStack because a class can't start with a number
import { ProjectStack } from '../lib/20096634-ts-project-1-stack';

const app = new cdk.App();
new ProjectStack(app, 'ProjectStack', {
  
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'eu-west-1' },

});
