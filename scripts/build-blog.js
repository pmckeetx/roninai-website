const fs = require('fs');
const path = require('path');
const { glob } = require('glob');
const matter = require('gray-matter');
const { marked } = require('marked');

// Configure marked for clean output
marked.setOptions({
  gfm: true,
  breaks: false
});

const BLOG_SRC = '_blog';
const BLOG_OUT = 'blog';
const TEMPLATES = '_templates';

// Read templates
const postTemplate = fs.readFileSync(path.join(TEMPLATES, 'blog-post.html'), 'utf8');
const indexTemplate = fs.readFileSync(path.join(TEMPLATES, 'blog-index.html'), 'utf8');

// Ensure output directory exists
if (!fs.existsSync(BLOG_OUT)) {
  fs.mkdirSync(BLOG_OUT, { recursive: true });
}

// Find all markdown files
async function buildBlog() {
  const files = await glob(`${BLOG_SRC}/**/*.md`);
  const posts = [];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const { data: frontmatter, content: markdown } = matter(content);

    // Validate required frontmatter
    if (!frontmatter.title || !frontmatter.date || !frontmatter.description) {
      console.error(`Missing required frontmatter in ${file}`);
      continue;
    }

    // Parse the path to get year and slug
    const relativePath = path.relative(BLOG_SRC, file);
    const parts = relativePath.split(path.sep);
    const year = parts[0];
    const slug = path.basename(file, '.md');

    // Convert markdown to HTML
    const htmlContent = marked(markdown);

    // Format date
    const date = new Date(frontmatter.date);
    const formattedDate = date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Build tags HTML
    const tagsHtml = frontmatter.tags
      ? frontmatter.tags.map(tag => `<span class="blog-tag">${tag}</span>`).join('')
      : '';

    // Generate post HTML
    const postHtml = postTemplate
      .replace(/{{title}}/g, frontmatter.title)
      .replace(/{{date}}/g, formattedDate)
      .replace(/{{description}}/g, frontmatter.description)
      .replace(/{{tags}}/g, tagsHtml)
      .replace(/{{content}}/g, htmlContent)
      .replace(/{{year}}/g, year)
      .replace(/{{slug}}/g, slug);

    // Create output directory for year
    const outDir = path.join(BLOG_OUT, year);
    fs.mkdirSync(outDir, { recursive: true });

    // Write post HTML as slug.html (not index.html in a folder)
    const outFile = path.join(outDir, `${slug}.html`);
    fs.writeFileSync(outFile, postHtml);
    console.log(`Generated: ${outFile}`);

    // Add to posts array for index (relative from blog/index.html)
    posts.push({
      title: frontmatter.title,
      date: date,
      formattedDate,
      description: frontmatter.description,
      tags: frontmatter.tags || [],
      url: `${year}/${slug}.html`,
      year
    });
  }

  // Sort posts by date (newest first)
  posts.sort((a, b) => b.date - a.date);

  // Group posts by year
  const postsByYear = {};
  for (const post of posts) {
    if (!postsByYear[post.year]) {
      postsByYear[post.year] = [];
    }
    postsByYear[post.year].push(post);
  }

  // Generate posts HTML for index
  const years = Object.keys(postsByYear).sort((a, b) => b - a);
  let postsListHtml = '';

  for (const year of years) {
    postsListHtml += `<div class="blog-year-group">`;
    postsListHtml += `<h2 class="blog-year">${year}</h2>`;
    postsListHtml += `<div class="blog-posts-list">`;

    for (const post of postsByYear[year]) {
      const tagsHtml = post.tags.length > 0
        ? `<div class="blog-post-tags">${post.tags.map(t => `<span class="blog-tag">${t}</span>`).join('')}</div>`
        : '';

      postsListHtml += `
        <article class="blog-post-item">
          <a href="${post.url}" class="blog-post-link">
            <time class="blog-post-date">${post.formattedDate}</time>
            <h3 class="blog-post-title">${post.title}</h3>
            <p class="blog-post-description">${post.description}</p>
            ${tagsHtml}
          </a>
        </article>
      `;
    }

    postsListHtml += `</div></div>`;
  }

  // Generate index HTML
  const indexHtml = indexTemplate.replace(/{{posts}}/g, postsListHtml);

  // Write blog/index.html
  fs.writeFileSync(path.join(BLOG_OUT, 'index.html'), indexHtml);
  console.log(`Generated: ${path.join(BLOG_OUT, 'index.html')}`);

  console.log(`\nBuild complete! ${posts.length} post(s) generated.`);
}

buildBlog().catch(console.error);
