import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router-dom';
import {helpArticles,searchHelp} from './content';
import {Help} from '../pages/Help';
describe('Help Center',()=>{
  it('covers all twelve requested topics with steps, examples, and FAQs',()=>{expect(helpArticles).toHaveLength(12);expect(new Set(helpArticles.map(a=>a.id)).size).toBe(12);for(const a of helpArticles){expect(a.steps.length).toBeGreaterThanOrEqual(3);expect(a.example.length).toBeGreaterThan(20);expect(a.faq.length).toBeGreaterThanOrEqual(2);expect(a.path.startsWith('/')).toBe(true);}});
  it('finds relevant help in titles and FAQ answers',()=>{expect(searchHelp('IPHONE').some(a=>a.id==='iphone')).toBe(true);expect(searchHelp('таблиц').some(a=>a.id==='notes')).toBe(true);expect(searchHelp('нескінченний невідомий запит')).toEqual([]);});
  it('keeps configuration jargon out of the user-facing articles',()=>{for(const a of helpArticles)expect([a.title,a.description,a.intro,...a.steps,a.example,...a.faq.flat()].join(' ')).not.toMatch(/OAuth|Client ID|CORS|CalDAV|Google Cloud|\bAPI\b/i);});
  it('renders an actual article for every category route',()=>{for(const a of helpArticles){const html=renderToStaticMarkup(<MemoryRouter initialEntries={[`/help?topic=${a.id}`]}><Help/></MemoryRouter>);expect(html).toContain(a.title.replaceAll('&','&amp;'));expect(html).toContain('Спробуй ось так');expect(html).toContain('Маленький приклад');expect(html).toContain('aria-expanded="false"');}});
  it('renders search, categories and a developer section collapsed by default',()=>{const html=renderToStaticMarkup(<MemoryRouter><Help/></MemoryRouter>);expect(html).toContain('Пошук інструкцій');expect(html).toContain('Для розробника / Технічне налаштування');expect(html).toContain('aria-hidden="true" inert=""');expect(html).toContain('help-category-grid');});
});
