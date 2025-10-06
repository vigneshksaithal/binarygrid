# Setup and Testing Guide

## What Was Implemented

✅ **Daily Automated Post Creation**
- Scheduler runs daily at midnight UTC (00:00)
- Automatically creates a new post with a unique puzzle
- Each post gets a medium difficulty puzzle by default

✅ **Post-Specific Puzzle Storage**
- Each post has its own unique puzzle stored in Redis
- Puzzles are permanently linked to post IDs
- No puzzle sharing across posts
- Puzzles persist even after server restarts

✅ **Updated API Endpoints**
- `/api/init` - Returns puzzle data for the current post
- `/api/puzzle` - Fetches post-specific puzzle from Redis
- `/api/submit` - Validates against the post's unique puzzle

✅ **Manual Post Creation**
- Moderators can still create posts via menu action
- Initial post created on app installation

## Prerequisites

Before testing, ensure you have:
- Node.js (v22.2.0+)
- Your Devvit environment set up
- Access to your test subreddit (r/binarygrid)

## Installation Steps

1. **Build the project:**
   ```bash
   npm install
   npm run build
   ```

2. **Deploy to your test subreddit:**
   ```bash
   npm run dev
   ```
   Or for production:
   ```bash
   npm run launch
   ```

## Testing the Implementation

### Test 1: Initial Post Creation
1. Install the app on your subreddit
2. An initial post should be created automatically
3. Click "Play Now" to verify the puzzle loads
4. Note the post ID from the URL

### Test 2: Manual Post Creation
1. Go to your subreddit
2. Click on the mod menu (three dots)
3. Select "Create a new Game"
4. A new post should be created
5. Verify it has a different puzzle than the first post

### Test 3: Puzzle Persistence
1. Open a post and note the puzzle configuration
2. Refresh the page
3. The puzzle should be identical (same clues in same positions)
4. Open the same post in a different browser/incognito
5. The puzzle should still be the same

### Test 4: Multiple Posts Have Different Puzzles
1. Create 2-3 posts using the menu action
2. Open each post in different tabs
3. Compare the puzzles - each should be unique
4. The fixed cells (clues) should be different

### Test 5: Scheduler (Wait for Daily Creation)
⚠️ **Note**: This requires waiting until midnight UTC

1. Wait for midnight UTC (00:00)
2. Check your subreddit after midnight
3. A new post should appear automatically
4. The post title should include today's date
5. The puzzle should be unique

**To test immediately** (optional):
- Modify the cron schedule in `devvit.json` temporarily:
  ```json
  "cron": "*/5 * * * *"  // Runs every 5 minutes
  ```
- Rebuild and redeploy
- Wait 5 minutes to see a new post created
- ⚠️ Remember to change it back to `"0 0 * * *"` for daily posts

### Test 6: Submission Validation
1. Open any post
2. Solve the puzzle (or enter a solution)
3. Submit the solution
4. Verify it validates against that post's puzzle only
5. Open a different post
6. The submission should not affect the other post

## Verifying Redis Storage

You can check that puzzles are being stored in Redis:

1. Each post should have a Redis hash key: `post:{postId}:puzzle`
2. Submissions are tracked with: `submission:{postId}:{puzzleId}`

## Troubleshooting

### Puzzle not loading
- Check browser console for errors
- Verify the post was created with `createPost()` function
- Check that Redis permissions are enabled in `devvit.json`

### Scheduler not running
- Verify the cron schedule is correct: `"0 0 * * *"`
- Check the endpoint is correct: `/internal/scheduler/daily-puzzle-post`
- Ensure the scheduler task is defined in `devvit.json`
- Check server logs for any errors

### Different posts showing same puzzle
- Verify the post ID is being used as the seed in `generatePuzzleForPost()`
- Check that `context.postId` is available in API endpoints
- Ensure Redis keys use the correct post ID: `post:{postId}:puzzle`

### Build errors
- Run `npm install` to ensure all dependencies are installed
- Check for TypeScript errors: `npm run build`
- Ensure all imports are correct

## Configuration Options

### Change Default Difficulty
In `src/server/index.ts`, modify the `createPost()` calls:
```typescript
const post = await createPost('easy')  // or 'medium', 'hard'
```

### Change Schedule Time
In `devvit.json`, modify the cron expression:
```json
"cron": "0 12 * * *"  // Runs at noon UTC
```

### Cron Schedule Examples
- `"0 0 * * *"` - Daily at midnight UTC
- `"0 12 * * *"` - Daily at noon UTC  
- `"0 0 * * 1"` - Every Monday at midnight
- `"*/30 * * * *"` - Every 30 minutes (for testing)

## Next Steps

After successful testing:

1. **Deploy to production**: Use `npm run launch`
2. **Monitor the scheduler**: Check that posts are created daily
3. **Gather user feedback**: See how players interact with daily puzzles
4. **Consider enhancements**:
   - Difficulty selection in menu form
   - Leaderboards per post
   - Post flair by difficulty
   - Puzzle archives

## Support

If you encounter issues:
- Check the [Devvit documentation](https://developers.reddit.com/docs/)
- Visit [r/devvit](https://www.reddit.com/r/devvit/)
- Join the [Devvit Discord](https://discord.gg/Cd43ExtEFS)
