# Daily Puzzle Implementation

## Overview
This implementation creates a daily puzzle system where:
1. A new post with a unique puzzle is automatically generated every day at midnight UTC
2. Each post has its own unique puzzle stored in Redis
3. The puzzle data is permanently linked to that specific post ID
4. Each post's puzzle never changes, regardless of when users play it

## Architecture

### 1. Scheduler Configuration (`devvit.json`)
- Added Redis permissions to store puzzle data
- Configured a cron job to run daily at midnight UTC: `"cron": "0 0 * * *"`
- Task name: `daily-puzzle-post`
- Endpoint: `/internal/scheduler/daily-puzzle-post`

### 2. Post Creation with Puzzle Storage (`src/server/core/post.ts`)
The `createPost()` function now:
- Accepts a `difficulty` parameter (defaults to 'medium')
- Creates a Reddit post with a title including the date and difficulty
- Generates a unique puzzle using the post ID as the seed
- Stores the puzzle in Redis using the key: `post:{postId}:puzzle`

The Redis hash stores:
- `id`: Puzzle identifier
- `size`: Grid size (6)
- `difficulty`: easy/medium/hard
- `fixed`: JSON stringified array of fixed cells
- `initial`: JSON stringified initial grid state

### 3. Puzzle Generation (`src/server/core/generator.ts`)
Added `generatePuzzleForPost()` function:
- Uses the post ID + timestamp as a seed for deterministic generation
- Each post gets a truly unique puzzle
- The puzzle is generated once when the post is created
- Uses the same validation and carving logic as the date-based generator

### 4. API Endpoints

#### `/api/init` (GET)
- Fetches puzzle data for the current post from Redis
- Returns the complete puzzle with initial state to the client
- Includes the current user's username

#### `/api/puzzle` (GET)
- Fetches the puzzle for the current post ID from Redis
- Returns the puzzle in a format the client can use
- No longer depends on date or difficulty query parameters

#### `/api/submit` (POST)
- Validates the submitted grid against the post's puzzle
- Stores submission records with post-specific keys: `submission:{postId}:{puzzleId}`
- Each submission is tracked per post

#### `/internal/scheduler/daily-puzzle-post` (POST)
- Scheduled to run daily at midnight UTC
- Automatically creates a new post with a medium difficulty puzzle
- Returns the created post ID for tracking

### 5. Data Storage Strategy

**Puzzle Storage:**
```
Key: post:{postId}:puzzle
Type: Hash
Fields:
  - id: string
  - size: string
  - difficulty: string
  - fixed: JSON string
  - initial: JSON string
```

**Submission Tracking:**
```
Key: submission:{postId}:{puzzleId}
Type: String
Value: "1"
```

## How It Works

1. **Daily Creation**: At midnight UTC, the scheduler triggers the creation of a new post
2. **Puzzle Generation**: A unique puzzle is generated using the post ID as a seed
3. **Storage**: The puzzle is immediately stored in Redis linked to the post ID
4. **User Access**: When a user opens any post, the client fetches the puzzle for that specific post
5. **Persistence**: The puzzle remains in Redis and never changes for that post
6. **Submission**: When users submit solutions, they're validated against the post-specific puzzle

## Benefits

1. **Post-Specific Puzzles**: Each post has its own unique puzzle that never changes
2. **No Date Dependencies**: Puzzles are not tied to dates, so posts can be created anytime
3. **Persistence**: All puzzle data is stored in Redis, surviving server restarts
4. **Scalability**: Each subreddit installation has its own Redis namespace
5. **Manual Override**: Moderators can still create posts manually via the menu action

## Testing

To test the implementation:

1. **Install the app**: The `onAppInstall` trigger will create an initial post
2. **Manual post creation**: Use the "Create a new Game" moderator menu action
3. **Wait for daily posts**: Posts will be automatically created at midnight UTC
4. **Verify uniqueness**: Each post should have a different puzzle
5. **Check persistence**: Refreshing the page should show the same puzzle

## Future Enhancements

Potential improvements:
- Allow moderators to choose difficulty when creating posts manually
- Add a form to the menu action for difficulty selection
- Implement puzzle archives or leaderboards per post
- Add post flair based on difficulty level
- Track completion statistics per post
