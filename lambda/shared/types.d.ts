// handles the source info for the db
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

// db entity, separates the movie info from the db design
export interface Movie {
  pk: string;        // "m#movieID e.g. m#848326
  sk: string;        // m#movieID" e.g m#848326
  id: number;        // original id 848326
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