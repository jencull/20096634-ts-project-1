# Movie Review API - Serverless Assignment 1
**Student Name:** Jennefer Cullinan
**Student ID:** 20096634

## Project Overview
This project is a secure, serverless Web API for managing movie reviews, built using AWS CDK, DynamoDB (Single Table Design), and Cognito for authentication. The project is hosted on AWS and juses the CDK to automate its infrastructure provisioning. 

## Setup & Deployment
1. `npm install`
2. `cdk deploy`

Managing Lambda dependencies with layers
https://docs.aws.amazon.com/lambda/latest/dg/chapter-layers.html

Working with lambda layers & nodejs 
https://docs.aws.amazon.com/lambda/latest/dg/nodejs-layers.html

Creating lambda layers with typescript & CDK
https://shawntorsitano.com/blog/cdk-lambda-layers/

Problems & Troubleshooting auth app stack in Cognito demo app. Changes carried over to this project.


tsconfig.json all changes commented in file
https://github.com/jencull/cognito-demo-app/blob/master/tsconfig.json

Update to resolve IDE errors 'resolveJsonModule' and 'esModuleInterop' are now required by TypeScript to bundle JSON schemas and handle modern module imports correctly. https://www.typescriptlang.org/tsconfig/#resolveJsonModule & microsoft/TypeScript#25400 Resolves "Cannot find module '../../shared/types.schema.json'. Consider using '--resolveJsonModule' to import module with '.json' extension." error in IDE in signup.ts

utils.ts all changes commented in file

imported StatementEffect, effct was set as a string but project using strict types for lambda. This sets the reponse to only accept 'allow' or 'deny' rather than something like 'maybe', which a string var would accept but AWS would not.

type mismatchs, importing the libraries resolved errors in IDE import jwt from 'jsonwebtoken' // npm i --save-dev @types/jsonwebtoken import jwkToPem from "jwk-to-pem"; // npm i --save-dev @types/jwk-to-pem

added 'as JwtToken' to end of return statement to enforce strict typing, resolve error in IDE return jwt.verify(token, pem, { algorithms: ["RS256"] }) as JwtToken;

ProjectStack troubleshooting: 

Students laptop uses podman, not Docker. Run below in terminal window: 

In order to deploy to AWS with podman run
CDK_DOCKER=podman npx cdk deploy

export CDK_DOCKER=podman (works for npx cdk synth)

npx cdk synth - builds project locally without sending anything to AWS. Very valuable tool for troubleshooting. 

Restart TS server - sync changes eg changes in paths, installing new packages. 

Testing auth lambdas

Signup, use AuthServiceApiEndpoint, POST - working
https://xxxxxx.execute-api.eu-west-1.amazonaws.com/prod/auth/signup
body (raw)
{
    "username": "userA",
    "password": "passwA!1",
    "email": "your_verified_email_identity"
}

Confirm signup, AuthServiceApiEndpoint, POST - working
https://xxxxxxxx.execute-api.eu-west-1.amazonaws.com/prod/auth/confirm-signup

{
    "username": "userA",
    "code": "your_verification_code"
}

Signin, AuthServiceApiEndpoint, POST - working
https://xxxxxxxx.execute-api.eu-west-1.amazonaws.com/prod/auth/signin

{
  "username": "userA",
  "password": "passwA!1"
}

Signout, AuthServiceApiEndpoint, GET - working
https://xxxxxxxx.execute-api.eu-west-1.amazonaws.com/prod/auth/signout

