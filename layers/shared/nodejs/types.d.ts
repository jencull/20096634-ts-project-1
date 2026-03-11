// handles the source info, the seed movie file, for the db
export interface MovieSource {
  id: number;
  title: string;
  release_date: string;
  overview: string;
  adult: boolean;
  backdrop_path: string;
  genre_ids: number[];
  original_language: string;
  original_title: string;
  popularity: number;
  poster_path: string;
  video: boolean;
  vote_average: number;
  vote_count: number;
}

// db entity, separates the movie info from the pk & sk
export interface Movie {
  pk: string;        // "m#movieID e.g. m#848326 must be a string because of the prefix
  sk: string;        // m#movieID" e.g m#848326 as above for string
  id: number;        // original id 848326 from seed file
  title: string;
  date: string;
  overview: string;
}

export interface Reviewer {
  pk: string;        // r#username e.g. r#UserA
  sk: string;        // r#username e.g., r#UserA
  name: string;      // Real name of the user
}

export interface Review {
  pk: string;        // movie m#movieID
  sk: string;        // reviewer r#username
  date: string;      // review publish date
  text: string;      // review content
  reviewerName?: string; // Optional
}
