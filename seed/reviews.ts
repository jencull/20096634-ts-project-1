import { Reviewer, Review } from '../lambda/shared/types';

// reviewers for testing purposes
export const reviewers: Reviewer[] = [
  {
    pk: "r#UserA",        
    sk: "r#UserA",
    name: "John Smith"
  },
  {
    pk: "r#UserB",
    sk: "r#UserB",
    name: "Mary Ryan"
  }
];

// reviews for testing purposes
export const reviews: Review[] = [
  {
    pk: "m#848326",       // movie m#movieID
    sk: "r#UserA",        // reviewer r#username
    date: "2024-03-10",   // local secondary index, allows searching by date
    text: "Action packed, fast moving, recommend.",
    reviewerName: "John Smith"
  },
  {
    pk: "m#572802",       // movie m#movieID
    sk: "r#UserB",        // reviewer r#username
    date: "2024-03-11",   // local secondary index, allows searching by date
    text: "Storyline has gaps, prep for a sequel?",
    reviewerName: "Mary Ryan"
  }
];