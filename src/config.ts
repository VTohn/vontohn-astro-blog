import type {
	ExpressiveCodeConfig,
	LicenseConfig,
	NavBarConfig,
	ProfileConfig,
	SiteConfig,
} from "./types/config";
import { LinkPreset } from "./types/config";

export const siteConfig: SiteConfig = {
	title: "VTohn's Zimmer",
	subtitle: "欢迎来到万冬的博客",
	lang: "zh_CN",
	themeColor: {
		hue: 210, // 对应原主题的 #496b8c 蓝灰
		fixed: false,
	},
	banner: {
		enable: false, // 换成一张横向的图之后可以改成 true，见 src/assets/images/
		src: "assets/images/background.png",
		position: "center",
		credit: {
			enable: false,
			text: "",
			url: "",
		},
	},
	toc: {
		enable: true,
		depth: 2,
	},
	favicon: [],
};

export const navBarConfig: NavBarConfig = {
	links: [
		LinkPreset.Home,
		LinkPreset.Archive,
		LinkPreset.About,
		{
			name: "GitHub",
			url: "https://github.com/VTohn",
			external: true,
		},
	],
};

export const profileConfig: ProfileConfig = {
	avatar: "assets/images/avatar.jpg",
	name: "VTohn",
	bio: "灵光乍现 · 记录学习与生活。",
	links: [
		{
			name: "GitHub",
			icon: "fa6-brands:github",
			url: "https://github.com/VTohn",
		},
	],
};

export const licenseConfig: LicenseConfig = {
	enable: true,
	name: "CC BY-NC 4.0",
	url: "https://creativecommons.org/licenses/by-nc/4.0/deed.zh-hans",
};

export const expressiveCodeConfig: ExpressiveCodeConfig = {
	theme: "github-dark",
};
