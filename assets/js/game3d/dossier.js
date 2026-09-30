// "Dossiers": the islanders answer questions about Yichen by opening the very same section that is
// on the page (cloned from the DOM, so the CV has one source of truth), inside a game-style window
// with a button that jumps to it on the page.
import { openModal, closeModal } from './modal.js';
import { mode } from './mode.js';
import { h, icon } from './util.js';

const CHAPTER = {
  about: 'About', education: 'Education', publications: 'Publications', experience: 'Experience', projects: 'Projects', contact: 'Contact',
};

export function openDossier(sectionId) {
  const sec = document.getElementById(sectionId);
  const card = sec?.querySelector('.card');
  if (!card) return false;
  const body = card.cloneNode(true);
  body.classList.remove('card');
  body.classList.add('dossier');
  body.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
  body.querySelectorAll('[data-focus], [tabindex], [data-say]').forEach((n) => { n.removeAttribute('data-focus'); n.removeAttribute('tabindex'); n.removeAttribute('data-say'); });
  body.querySelector('.tag')?.remove();
  body.querySelector('h2')?.remove();
  body.querySelector('.portrait')?.remove();
  body.querySelector('.eggline')?.remove();
  body.querySelectorAll('a[href^="#"]').forEach((a) => a.removeAttribute('href'));
  openModal({
    id: 'dossier',
    title: CHAPTER[sectionId] || sectionId,
    className: 'dossier-panel wide-panel',
    body: (b) => b.append(body, h('div', { class: 'modal__actions' },
      h('button', { type: 'button', class: 'btn btn--small btn--primary', onclick: () => go(sectionId) }, icon('arrow-up-right', { size: 14 }), ' Show me on the page'),
      h('button', { type: 'button', class: 'btn btn--small', onclick: () => closeModal('dossier') }, 'Close'),
    )),
  });
  return true;
}

function go(sectionId) {
  closeModal('dossier');
  if (mode.play) window.__g?.exitPlay();
  setTimeout(() => document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
}
