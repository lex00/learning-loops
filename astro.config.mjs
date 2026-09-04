// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  site: 'https://lex00.github.io',
  base: '/learning-loops',
  redirects: { '/': '/learning-loops/concurrency/waiting-on-io/' },
  integrations: [
    starlight({
      title: 'Learning Loops',
      description: 'Looping scenes that teach one programming concept at a time.',
      customCss: ['./src/styles/custom.css'],
      pagefind: false,
      components: { PageTitle: './src/components/PageTitle.astro' },
      head: [
        { tag: 'link', attrs: { rel: 'preconnect', href: 'https://fonts.googleapis.com' } },
        { tag: 'link', attrs: { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: true } },
        { tag: 'link', attrs: { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&family=IBM+Plex+Mono:wght@400;500&display=swap' } },
      ],
      sidebar: [
        { label: 'Concurrency', items: [{ autogenerate: { directory: 'concurrency' } }] },
      ],
    }),
  ],
});
