import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as custom from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';
import { generateBatch, transformMovie } from '../../shared/utils';
import { Movie } from '../../shared/types';
import * as moviesData from '../../seed/movies';
import * as reviewsData from '../../seed/reviews';

export class MoviesTable extends Construct {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id);

        // single table definition
        const moviesTable = new dynamodb.Table(this, "MoviesTable", {
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
            sortKey: { name: "sk", type: dynamodb.AttributeType.STRING },
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            tableName: "Movies",
        });

        // local secondary index (LSI) for date-based searching
        moviesTable.addLocalSecondaryIndex({
            indexName: "reviewDateIx",
            sortKey: { name: "date", type: dynamodb.AttributeType.STRING },
        });

        new custom.AwsCustomResource(this, "moviesddbInitData", {
            onCreate: {
                service: "DynamoDB",
                action: "batchWriteItem",
                parameters: {
                    RequestItems: {
                        [moviesTable.tableName]: [
                            // transforms movies into movie entities, creates a list of PUT requests
                            ...generateBatch(moviesData.movies.map(transformMovie)),
                            // add reviews, creates list
                            ...generateBatch(reviewsData.reviews),
                            // add reviewers, creates list
                            ...generateBatch(reviewsData.reviewers),
                        ],
                    },
                },
                physicalResourceId: custom.PhysicalResourceId.of("moviesddbInitData"),
            },
            policy: custom.AwsCustomResourcePolicy.fromSdkCalls({
                resources: [moviesTable.tableArn],
            }),
        });
    }
}