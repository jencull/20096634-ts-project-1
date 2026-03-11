import { Aws } from "aws-cdk-lib";
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

        // movie functions
        const getMovieReviewsFn = new node.NodejsFunction(this, "GetMovieReviewsFn", {
            ...appCommonFnProps,
            entry: `${__dirname}/../../lambda/movies/getMovieReviews.ts`,
        });

        const addReviewFn = new node.NodejsFunction(this, "AddReviewFn", {
            ...appCommonFnProps,
            entry: `${__dirname}/../../lambda/movies/addReview.ts`,
        });

        const updateReviewFn = new node.NodejsFunction(this, "UpdateReviewFn", {
            ...appCommonFnProps,
            entry: `${__dirname}/../../lambda/movies/updateReview.ts`,
        });

        // permisions
        props.moviesTable.grantReadData(getMovieReviewsFn);
        props.moviesTable.grantReadWriteData(addReviewFn);

        // routes
        const movies = appApi.root.addResource("movies");
        const movie = movies.addResource("{movieID}");
        const reviews = movie.addResource("reviews");

        // GET /movies/{movieID}/reviews - public
        reviews.addMethod("GET", new apig.LambdaIntegration(getMovieReviewsFn));

        // POST /movies/reviews - protected - requires login
        // Project spec says POST /movies/reviews so add it to movie resource
        const allReviews = movies.addResource("reviews");
        allReviews.addMethod("POST", new apig.LambdaIntegration(addReviewFn), {
            authorizer: requestAuthorizer,
            authorizationType: apig.AuthorizationType.CUSTOM,
        });
    }
}
