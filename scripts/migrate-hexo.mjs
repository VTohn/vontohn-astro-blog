/*
 * One-shot migration: Hexo (source/_posts) -> Astro content collection (src/content/posts)
 *
 * Usage:
 *   node scripts/migrate-hexo.mjs [hexoRoot]
 *
 * Default hexoRoot: ../vontohn-blog/source/_posts
 *
 * What it does:
 *   - converts front matter: date -> published, categories -> category, tags -> tags[]
 *   - keeps the Asia/Shanghai offset so displayed dates match the Hexo site
 *   - generates a `description` (used by the post card) when the post has no excerpt
 *   - rewrites Hexo asset tags `{% asset_img file.jpg caption %}` into markdown images
 *   - posts that own an asset folder become `<name>/index.md` with the images copied next to them
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const projectRoot = path.resolve(import.meta.dirname, "..");
const hexoPostsDir = path.resolve(
	process.argv[2] ?? path.join(projectRoot, "../vontohn-blog/source/_posts"),
);
const destDir = path.join(projectRoot, "src/content/posts");
const timezoneOffset = "+08:00";

// Hexo 里存在、但不想搬到新站的帖子。
const EXCLUDED = new Set(["测试页面.md"]);

function unquote(value) {
	const v = value.trim();
	if (
		(v.startsWith('"') && v.endsWith('"')) ||
		(v.startsWith("'") && v.endsWith("'"))
	) {
		return v.slice(1, -1);
	}
	return v;
}

/** Minimal front-matter parser for the simple YAML used by the Hexo site. */
function parseFrontMatter(raw) {
	const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
	if (!match) return { data: {}, body: raw };

	const data = {};
	let currentKey = null;

	for (const line of match[1].split(/\r?\n/)) {
		if (!line.trim()) continue;

		const listItem = line.match(/^\s+-\s+(.*)$/);
		if (listItem && currentKey) {
			if (!Array.isArray(data[currentKey])) {
				data[currentKey] = data[currentKey] === "" ? [] : [data[currentKey]];
			}
			data[currentKey].push(unquote(listItem[1]));
			continue;
		}

		const kv = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
		if (kv) {
			currentKey = kv[1];
			const value = kv[2].trim();
			data[currentKey] = value === "" ? "" : unquote(value);
		}
	}

	return { data, body: raw.slice(match[0].length) };
}

function toIsoDate(value) {
	if (!value) return new Date().toISOString();
	// "2026-09-15 23:08:02" -> "2026-09-15T23:08:02+08:00"
	const normalised = String(value).trim().replace(" ", "T");
	return /[+-]\d{2}:\d{2}$|Z$/.test(normalised)
		? normalised
		: `${normalised}${timezoneOffset}`;
}

function toArray(value) {
	if (!value) return [];
	if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
	return [String(value).trim()].filter(Boolean);
}

/** First meaningful paragraph, used as the card summary when there is no description. */
function buildDescription(body, title) {
	const text = body
		.replace(/```[\s\S]*?```/g, "")
		.replace(/!\[[^\]]*\]\([^)]*\)/g, "")
		.replace(/^\s*#{1,6}.*$/gm, "")
		.replace(/^\s*>.*$/gm, "")
		.replace(/^\s*[-*_]{3,}\s*$/gm, ""); // thematic breaks like *** / ****

	for (const block of text.split(/\n\s*\n/)) {
		const line = block
			.replace(/[*_`~\[\]()]/g, "")
			.replace(/\s+/g, " ")
			.trim();
		if (line.length >= 4 && line !== title) return line.slice(0, 90);
	}
	return "";
}

function convertAssetTags(body) {
	const leftovers = [];
	const converted = body.replace(
		/\{%\s*asset_img\s+([^\s%]+)\s*([^%]*?)%\}/g,
		(_match, file, caption) => {
			const alt = String(caption ?? "").trim() || file;
			return `![${alt}](./${file})`;
		},
	);

	for (const tag of converted.matchAll(/\{%\s*([a-z_]+)[\s\S]*?%\}/g)) {
		leftovers.push(tag[0]);
	}
	return { converted, leftovers };
}

function yamlString(value) {
	return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function buildFrontMatter({ title, published, description, tags, category }) {
	return [
		"---",
		`title: ${yamlString(title)}`,
		`published: ${published}`,
		`description: ${yamlString(description)}`,
		"image: ''",
		`tags: [${tags.map(yamlString).join(", ")}]`,
		`category: ${category ? yamlString(category) : "''"}`,
		"draft: false",
		"lang: ''",
		"---",
		"",
	].join("\n");
}

if (!fs.existsSync(hexoPostsDir)) {
	console.error(`Hexo posts directory not found: ${hexoPostsDir}`);
	process.exit(1);
}

fs.rmSync(destDir, { recursive: true, force: true });
fs.mkdirSync(destDir, { recursive: true });

const skipped = [];
let migrated = 0;

for (const entry of fs.readdirSync(hexoPostsDir, { withFileTypes: true }).sort((a, b) =>
	a.name.localeCompare(b.name),
)) {
	if (!entry.name.endsWith(".md") || EXCLUDED.has(entry.name)) continue;

	const sourceFile = path.join(hexoPostsDir, entry.name);
	const raw = fs.readFileSync(sourceFile, "utf8");
	const { data, body } = parseFrontMatter(raw);

	const baseName = entry.name.replace(/\.md$/, "");
	const assetDir = path.join(hexoPostsDir, baseName);
	const hasAssets = fs.existsSync(assetDir) && fs.statSync(assetDir).isDirectory();

	const { converted, leftovers } = convertAssetTags(body);
	if (leftovers.length > 0) {
		skipped.push(`${entry.name}: ${leftovers.join(" ")}`);
	}

	const title = data.title ?? baseName;
	const published = toIsoDate(data.date);
	const tags = toArray(data.tags);
	const category = toArray(data.categories)[0] ?? "";
	const description = data.description?.trim() || buildDescription(converted, title);
	const frontMatter = buildFrontMatter({ title, published, description, tags, category });

	if (hasAssets) {
		const postDir = path.join(destDir, baseName);
		fs.mkdirSync(postDir, { recursive: true });
		for (const asset of fs.readdirSync(assetDir)) {
			fs.copyFileSync(path.join(assetDir, asset), path.join(postDir, asset));
		}
		fs.writeFileSync(path.join(postDir, "index.md"), frontMatter + converted.trimStart());
	} else {
		fs.writeFileSync(path.join(destDir, entry.name), frontMatter + converted.trimStart());
	}

	migrated += 1;
	console.log(`  ✓ ${entry.name}  [${category || "无分类"}] ${tags.join("/") || "无标签"}`);
}

console.log(`\n迁移完成：${migrated} 篇 -> ${path.relative(projectRoot, destDir)}`);
if (skipped.length > 0) {
	console.log("\n以下文件仍含未转换的 Hexo 标签，请手动检查：");
	skipped.forEach((line) => console.log(`  ! ${line}`));
}
