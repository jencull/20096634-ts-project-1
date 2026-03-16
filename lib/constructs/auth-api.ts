import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as apig from "aws-cdk-lib/aws-apigateway";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as node from "aws-cdk-lib/aws-lambda-nodejs";

// guide: https://github.com/jencull/cognito-demo-app/blob/master/lib/constructs/auth-api.ts
type AuthApiProps = {
  userPoolId: string;
  userPoolClientId: string;
  sharedLayer: lambda.ILayerVersion; // access interface for shared layer
};

export class AuthApi extends Construct {
  private auth: apig.IResource;
  private userPoolId: string;
  private userPoolClientId: string;
  private sharedLayer: lambda.ILayerVersion;

  constructor(scope: Construct, id: string, props: AuthApiProps) {
    super(scope, id);

    this.userPoolId = props.userPoolId;
    this.userPoolClientId = props.userPoolClientId;
    this.sharedLayer = props.sharedLayer; // Initialize the layer

    const api = new apig.RestApi(this, "AuthServiceApi", {
      description: "Authentication Service RestApi",
      endpointTypes: [apig.EndpointType.REGIONAL],
      defaultCorsPreflightOptions: {
        allowOrigins: apig.Cors.ALL_ORIGINS,
      },
    });

    // Request validator
    // works on entry point to check info is correct before lambda invoked
    // if error is caught the lambda won't run, saves unnecessary costs
    const requestValidator = new apig.RequestValidator(this, "AuthRequestValidator", {
      restApi: api,
      // check body of request
      validateRequestBody: true,
      // not checking query params as validated in methods
      validateRequestParameters: false,
    });

    // Validator model for signup and signin
    const authModel = new apig.Model(this, "AuthModel", {
      restApi: api,
      contentType: "application/json",
      schema: {
        type: apig.JsonSchemaType.OBJECT,
        // email and password must be present
        required: ["email", "password"],
        properties: {
          email: { type: apig.JsonSchemaType.STRING }, //  string - will be checked by validator
          password: { type: apig.JsonSchemaType.STRING, minLength: 8 } // string with min 8 chars will be checked by validator
        },
      },
    });

    // Model for confirm-signup, requires a code
    const confirmModel = new apig.Model(this, "ConfirmModel", {
      restApi: api,
      contentType: "application/json",
      schema: {
        type: apig.JsonSchemaType.OBJECT,
        required: ["email", "code"],
        properties: {
          email: { type: apig.JsonSchemaType.STRING },
          // length for cognito code from the email confirmation, will strip leading 0's if set to number
          code: { type: apig.JsonSchemaType.STRING, minLength: 6 }
        },
      },
    });

    this.auth = api.root.addResource("auth");

    // routes with validation applied to POST
    this.addAuthRoute("signup", "POST", "SignupFn", "signup.ts", requestValidator, authModel);
    this.addAuthRoute("confirm-signup", "POST", "ConfirmFn", "confirm-signup.ts", requestValidator, confirmModel);
    this.addAuthRoute("signin", "POST", "SigninFn", "signin.ts", requestValidator, authModel);
    // signout is a GET, no validation
    this.addAuthRoute("signout", "GET", "SignoutFn", "signout.ts");
  }

  // helper method, saves having to repeat code by using this instead of individually building 
  // lambdas for each route/endpoint. Includes request validation for all auth methods.
  // https://github.com/jencull/cognito-demo-app/blob/master/lib/constructs/auth-api.ts#L46
  private addAuthRoute(
    resourceName: string,
    method: string,
    fnName: string,
    fnEntry: string,
    validator?: apig.RequestValidator, // optional validator - optional as won't be used for GET
    model?: apig.Model                 // optional model - optional as won't be used for GET
  ): void {
    const commonFnProps = {
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "handler",
      layers: [this.sharedLayer], // attached layer here
      environment: {
        USER_POOL_ID: this.userPoolId,
        CLIENT_ID: this.userPoolClientId,
        REGION: cdk.Aws.REGION,
      },
    };

    const resource = this.auth.addResource(resourceName);

    const fn = new node.NodejsFunction(this, fnName, {
      ...commonFnProps,
      entry: `${__dirname}/../../lambda/auth/${fnEntry}`,
    });

    resource.addMethod(method, new apig.LambdaIntegration(fn), {
      requestValidator: validator,
      requestModels: model ? { "application/json": model } : undefined,
    });
  }
}
