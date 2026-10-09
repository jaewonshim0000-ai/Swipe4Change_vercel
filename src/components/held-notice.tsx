import type { Petition } from '../domain/model';
import { screenLabels } from '../domain/content-screen';
import { Notice } from './ui';

/** Why a petition its organizers can see is not public, if it is not. */
export function heldMessage(p: Pick<Petition, 'hidden' | 'heldFor' | 'checking'>) {
  if (!p.hidden) return null;
  if (p.checking)
    return 'Checking your petition. It goes public as soon as the automatic check passes, usually within seconds.';
  if (p.heldFor?.length)
    return `Not public yet: the automatic check flagged possible ${p.heldFor.map((k) => screenLabels[k]).join(', ')}. Edit the wording in Manage to fix it (it is checked again automatically), or wait for a trusted reviewer.`;
  return 'Hidden from the public. After a report, the automatic review flagged this petition’s wording. A trusted reviewer decides whether it returns; until then only its organizers can see it.';
}

export function HeldNotice({ petition }: { petition: Petition }) {
  const text = heldMessage(petition);
  return text ? <Notice error={!petition.checking} text={text} /> : null;
}
