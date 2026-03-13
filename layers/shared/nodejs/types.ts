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
    reviewerID: string; // username
    name: string;      // Real name of the user
}

export interface Review {
    pk: string;        // movie m#movieID
    sk: string;
    movieID: number;
    reviewerID: string;
    date: string;      // review publish date
    text: string;      // review content
}

export type SignUpBody = {
    username: string;
    password: string;
    email: string
}

export type ConfirmSignUpBody = {
    username: string;
    code: string;
}

export type SignInBody = {
    username: string;
    password: string;
}
