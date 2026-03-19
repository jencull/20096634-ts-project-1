import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as apig from "aws-cdk-lib/aws-apigateway";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as node from "aws-cdk-lib/aws-lambda-nodejs";
import * as tdb from "aws-cdk-lib/aws-dynamodb";

type AppApiProps = {
    userPoolId: string;
    userPoolClientId: string;
    moviesTable: tdb.ITable;
    sharedLayer: lambda.ILayerVersion; // access interface for shared layer
};

export class AppApi extends Construct {
    constructor(scope: Construct, id: string, props: AppApiProps) {
        super(scope, id);

        // Common properties for all functions
        const appCommonFnProps = {
            architecture: lambda.Architecture.ARM_64,
            timeout: cdk.Duration.seconds(10),
            memorySize: 128,
            runtime: lambda.Runtime.NODEJS_18_X,
            handler: "handler",
            layers: [props.sharedLayer],
            environment: {
                USER_POOL_ID: props.userPoolId,
                CLIENT_ID: props.userPoolClientId,
                REGION: cdk.Aws.REGION,
                TABLE_NAME: props.moviesTable.tableName,
            },
            bundling: {
                externalModules: ["/opt/nodejs/types"],
            },
        };

        // authorizer function
        const authorizerFn = new node.NodejsFunction(this, "AuthorizerFn", {
            ...appCommonFnProps,
            entry: `${__dirname}/../../lambda/auth/authorizer.ts`,
        });

        const requestAuthorizer = new apig.RequestAuthorizer(
            this,
            "RequestAuthorizer",
            {
                identitySources: [apig.IdentitySource.header("cookie")],
                handler: authorizerFn,
                resultsCacheTtl: cdk.Duration.minutes(0),
            }
        );

        // app api
        const appApi = new apig.RestApi(this, "AppApi", {
            description: "Movie Review App API",
            endpointTypes: [apig.EndpointType.REGIONAL],
            defaultCorsPreflightOptions: {
                allowOrigins: apig.Cors.ALL_ORIGINS,
            },
        });

        // Used this because the API gateway validation wasn't working on addReview
        // and updateReview. The only info being returned was "Invalid request body"
        // This gave more info which turned out to be 'unable to parse body as json'
        // In the end the fix was to use the Content-Length option in header info.
        appApi.addGatewayResponse("BadRequestBody", {
            type: apig.ResponseType.BAD_REQUEST_BODY,
            statusCode: "400",
            responseHeaders: {
                "Access-Control-Allow-Origin": "'*'",
            },
            templates: {
                "application/json": '{"message": "Invalid request body", "validationError": "$context.error.validationErrorString"}',
            },
        });

        // API gateway validation

        // Request validator
        // works on entry point to check info is correct before lambda invoked
        // if error is caught the lambda won't run, saves unnecessary costs
        const requestValidator = new apig.RequestValidator(this, "ApiValidator", {
            restApi: appApi,
            // check body of request
            validateRequestBody: true,
            // not checking query params as validated in methods, more control over error messages
            validateRequestParameters: false,
        });

        // definition for incoming data (the model)
        const addReviewModel = new apig.Model(this, "AddReviewModel", {
            restApi: appApi,
            contentType: "application/json",
            schema: {
                type: apig.JsonSchemaType.OBJECT,
                // these items must be present
                required: ["movieID", "date", "text"],
                properties: {
                    movieID: { type: apig.JsonSchemaType.NUMBER },
                    date: { type: apig.JsonSchemaType.STRING }, // string
                    text: { type: apig.JsonSchemaType.STRING, minLength: 1 }
                },
            },
        });

        // definition for incoming data (the model)
        const updateReviewModel = new apig.Model(this, "UpdateReviewModel", {
            restApi: appApi,
            contentType: "application/json",
            schema: {
                type: apig.JsonSchemaType.OBJECT,
                // these items must be present
                required: ["date", "text"],
                properties: {
                    date: { type: apig.JsonSchemaType.STRING }, // string
                    text: { type: apig.JsonSchemaType.STRING, minLength: 1 }
                },
            },
        });

        // movie functions

        // GET /movies/{movieID}/reviews - public 
        // Get all reviews for a specific movie or a single review by a specific user
        const getMovieReviewsFn = new node.NodejsFunction(this, "GetMovieReviewsFn", {
            ...appCommonFnProps,
            entry: `${__dirname}/../../lambda/movies/getMovieReviews.ts`,
        });
        // POST /movies/reviews - Protected
        // Allows an authenticated user to create a new review
        const addReviewFn = new node.NodejsFunction(this, "AddReviewFn", {
            ...appCommonFnProps,
            entry: `${__dirname}/../../lambda/movies/addReview.ts`,
        });
        // PUT /movies/{movieID}/reviews - protected
        // Allows an authenticated user to update their existing review text or date
        const updateReviewFn = new node.NodejsFunction(this, "UpdateReviewFn", {
            ...appCommonFnProps,
            entry: `${__dirname}/../../lambda/movies/updateReview.ts`,
        });
        // GET /reviews - public
        // Search for reviews by movie and date, uses LSI
        const getFilteredReviewsFn = new node.NodejsFunction(this, "GetFilteredReviewsFn", {
            ...appCommonFnProps,
            entry: `${__dirname}/../../lambda/movies/getFilteredReviews.ts`,
        });

        // permisions
        props.moviesTable.grantReadData(getMovieReviewsFn);
        props.moviesTable.grantReadWriteData(addReviewFn);
        props.moviesTable.grantWriteData(updateReviewFn);
        props.moviesTable.grantReadData(getFilteredReviewsFn);

        // routes
        const movies = appApi.root.addResource("movies");

        // GET /reviews?movie=ID&published=YEAR - public
        const filteredReviews = appApi.root.addResource("reviews");
        filteredReviews.addMethod("GET", new apig.LambdaIntegration(getFilteredReviewsFn));

        // POST /movies/reviews - protected - requires login
        // Project spec says POST /movies/reviews so add it to movie resource
        const allReviews = movies.addResource("reviews");
        allReviews.addMethod("POST", new apig.LambdaIntegration(addReviewFn), {
            authorizer: requestAuthorizer,
            authorizationType: apig.AuthorizationType.CUSTOM,
            // api gateway request validation
            requestValidator: requestValidator,
            requestModels: {
            "application/json": addReviewModel,
         },
        });

        const movie = movies.addResource("{movieID}");
        const reviews = movie.addResource("reviews");

        // GET /movies/{movieID}/reviews - public
        reviews.addMethod("GET", new apig.LambdaIntegration(getMovieReviewsFn));
        // PUT /movies/{movieID}/reviews - protected - requires login
        reviews.addMethod("PUT", new apig.LambdaIntegration(updateReviewFn), {
            authorizer: requestAuthorizer,
            authorizationType: apig.AuthorizationType.CUSTOM,
            // api gateway request validation
            requestValidator: requestValidator,
            requestModels: {
                "application/json": updateReviewModel,
            },
        });
    }
}
