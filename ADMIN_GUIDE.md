# Admin Guide - Adding Adventures

This guide explains how to use the admin interface to add new adventures to your website.

## One-Time Setup: GitHub Personal Access Token

To upload adventures directly to GitHub, you need to create a Personal Access Token.

### Step 1: Create a GitHub Token

1. Go to [GitHub Token Settings](https://github.com/settings/tokens/new?scopes=repo&description=Website%20Admin)
2. You should see a form to create a new token
3. **Description**: "Website Admin" (or any name you prefer)
4. **Expiration**: Choose an expiration date (recommend 90 days or 1 year)
5. **Scopes**: Make sure **`repo`** (Full control of private repositories) is checked
6. Click **"Generate token"** at the bottom
7. **IMPORTANT**: Copy the token immediately - you won't be able to see it again!

### Step 2: Save Your Token

1. Open `admin.html` in your browser (from GitHub Pages or locally)
2. Paste your token into the "GitHub Personal Access Token" field
3. Click **"Save Token"**
4. When prompted, enter your repository name (e.g., "website")
5. You should see a success message: "✓ Connected to [your-username]/[repo-name]"

**Security Notes:**
- Your token is stored in your browser's localStorage (stays on your device)
- Never share your token with anyone
- If you lose it, create a new one and delete the old one
- You can revoke tokens anytime at https://github.com/settings/tokens

## Adding a New Adventure

Once your token is set up, adding an adventure is easy:

### Step 1: Fill Out the Form

1. **Adventure ID**: A unique identifier (lowercase, numbers, hyphens only)
   - Example: `grays-peak-2024` or `maroon-bells-hike`

2. **Title**: The display name of your adventure
   - Example: "Grays Peak Summit" or "Maroon Bells Backpacking"

3. **Date**: When the adventure took place

4. **Description**: Write about your adventure
   - Tell the story, describe conditions, share highlights
   - Can be as long as you want

### Step 2: Upload Files

1. **GPX File**: Upload the route file from onX
   - Must be a `.gpx` file

2. **Photos**: Select all photos you want to include
   - You can select multiple photos at once
   - The first photo is the cover by default
   - Use the radio buttons to select a different cover photo if desired

### Step 3: Upload to GitHub

1. Click **"Upload Adventure to GitHub"**
2. A progress overlay will show the upload status:
   - Preparing upload
   - Getting repository info
   - Reading current data
   - Uploading GPX and photos
   - Creating commit
   - Pushing to GitHub

3. When complete, you'll see:
   - Success message
   - Links to view the commit and files on GitHub
   - The form will reset for the next adventure

### Step 4: Wait for Deployment

- If you're using GitHub Pages, your changes will be live in a few minutes
- The new adventure will appear on your website's Adventures section

## Accessing the Admin Interface

### Option 1: GitHub Pages (Recommended)
Once you push `admin.html` to your repository, you can access it at:
```
https://[your-username].github.io/[repo-name]/admin.html
```

### Option 2: Local Access
Open the file directly in your browser:
```
file:///path/to/your/website/admin.html
```

## Troubleshooting

### "Invalid token or insufficient permissions"
- Your token may have expired or been revoked
- Create a new token and save it again
- Make sure the token has `repo` scope

### "GitHub repository not configured"
- Click "Save Token" again and enter your repository name when prompted
- Make sure you enter the correct repository name (not the full URL)

### Upload fails partway through
- Check your internet connection
- Make sure your token hasn't expired
- Check the browser console (F12) for specific error messages
- Try refreshing the page and uploading again

### Photos are too large / Upload is slow
- Consider resizing photos before upload (recommended max 2-3MB per photo)
- GPX files are small and should upload quickly
- Upload time depends on the number and size of photos

## Tips

1. **Organize Your Photos**: Before uploading, rename photos on your computer so they're in the order you want them displayed

2. **Choose a Good Cover Photo**: This is the first image visitors see - pick one that represents the adventure well

3. **Write Engaging Descriptions**: Share what made the adventure special, challenges you faced, tips for others

4. **Use Descriptive IDs**: Make adventure IDs descriptive and include the year for easy reference

5. **Test Locally First**: After uploading, visit your website to make sure everything looks correct

## File Structure

After uploading, your adventure files will be organized like this:
```
adventures/
├── adventures.json                    # Metadata for all adventures
├── grays-peak-2024/
│   ├── route.gpx                     # Your GPS track
│   ├── cover.jpg                     # Cover photo
│   ├── photo-1.jpg                   # Additional photos
│   ├── photo-2.jpg
│   └── photo-3.jpg
└── your-next-adventure/
    └── ...
```

## Questions or Issues?

If you encounter any problems or have questions about using the admin interface, check the browser console (F12 → Console tab) for detailed error messages.
