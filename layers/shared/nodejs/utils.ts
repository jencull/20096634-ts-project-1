// this file is called /opt/nodejs/utils.js when its transpiled
// thats what is imported to the lambda functions

import { marshall } from "@aws-sdk/util-dynamodb";
import { Movie, MovieSource, Review, Reviewer } from "./types";

// entities in dynamodb table
type Entity = Movie | Review | Reviewer; 

// maps the movies.ts (MovieSource) info with to the Movie interface that has pk & sk info
// movies.ts (MovieSource) isn't edited and can be updated at any stage without editing the json
// similar to https://github.com/jencull/ds-ts-lab/blob/main/src/05-utilityTypes.ts#L19
// building a new movie object from an 'old' one in the movies.ts seed file
// used in the constructs/dynamodb-table.ts
export const transformMovie = (m: MovieSource): Movie => {
  return {
    pk: `m#${m.id}`,
    sk: `m#${m.id}`,
    id: m.id,
    title: m.title,
    date: m.release_date, // Mapping TMDB release_date to use as LSI sk date
    overview: m.overview
  };
};

// wraps each item in a PUT request
export const generateItem = (entity: Entity) => {
  return {
    PutRequest: {
      Item: marshall(entity),
    },
  };
};

// wraps an array of items into a list of PUT requests
export const generateBatch = (data: Entity[]) => {
  return data.map((e) => {
    return generateItem(e);
  });
};
