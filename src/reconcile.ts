const sourceSnapshots = new WeakMap<Element, string>();
const retained = 'pre,p,audio,video,[data-preview],[data-math],[data-diagram]';
const interactive =
  'details,form,button,input,textarea,select,spoiler,time,[data-afm-type],[data-afm-action],[data-math],[data-diagram],[data-preview]';

function sameKind(left: Node, right: Node) {
  return (
    left.nodeType === right.nodeType &&
    (!(left instanceof Element) ||
      (right instanceof Element &&
        left.namespaceURI === right.namespaceURI &&
        left.localName === right.localName))
  );
}

/** Patch sanitized content in place. Identity is native id, then sibling position. */
export function reconcile(root: HTMLElement, html: string) {
  const template = root.ownerDocument.createElement('template');
  template.innerHTML = html;
  const selection = root.ownerDocument.getSelection();
  const savedSelection =
    selection?.rangeCount &&
    root.contains(selection.anchorNode) &&
    root.contains(selection.focusNode)
      ? {
          anchor: selection.anchorNode!,
          anchorOffset: selection.anchorOffset,
          focus: selection.focusNode!,
          focusOffset: selection.focusOffset,
        }
      : undefined;

  function children(parent: Node, incoming: Node) {
    const keyed = new Map(
      Array.from(parent.childNodes).flatMap((node) =>
        node instanceof Element && node.id ? [[node.id, node] as const] : [],
      ),
    );
    let cursor = parent.firstChild;
    for (const next of Array.from(incoming.childNodes)) {
      const key = next instanceof Element ? next.id : '';
      const candidate = key
        ? keyed.get(key)
        : cursor instanceof Element && cursor.id
          ? undefined
          : cursor;
      let current: Node;
      if (candidate && sameKind(candidate, next)) {
        current = candidate;
        if (current !== cursor) parent.insertBefore(current, cursor);
      } else {
        current = next.cloneNode(false);
        parent.insertBefore(current, cursor);
      }
      if (current instanceof Element && next instanceof Element) {
        const source =
          next.matches(retained) && !next.querySelector(interactive) ? next.outerHTML : undefined;
        const preserve =
          source !== undefined &&
          sourceSnapshots.get(current) === source &&
          (next.localName !== 'p' || current.isEqualNode(next));
        if (!preserve) {
          for (const attr of Array.from(current.attributes))
            if (!next.hasAttribute(attr.name)) current.removeAttribute(attr.name);
          for (const attr of Array.from(next.attributes))
            if (current.getAttribute(attr.name) !== attr.value)
              current.setAttribute(attr.name, attr.value);
          children(current, next);
        }
        if (source !== undefined) sourceSnapshots.set(current, source);
        else sourceSnapshots.delete(current);
      } else if (current.nodeValue !== next.nodeValue) current.nodeValue = next.nodeValue;
      cursor = current.nextSibling;
    }
    while (cursor) {
      const next = cursor.nextSibling;
      parent.removeChild(cursor);
      cursor = next;
    }
  }
  children(root, template.content);
  if (
    savedSelection &&
    root.contains(savedSelection.anchor) &&
    root.contains(savedSelection.focus)
  ) {
    const limit = (node: Node, offset: number) =>
      Math.min(
        offset,
        node.nodeType === Node.TEXT_NODE ? (node.textContent?.length ?? 0) : node.childNodes.length,
      );
    selection!.setBaseAndExtent(
      savedSelection.anchor,
      limit(savedSelection.anchor, savedSelection.anchorOffset),
      savedSelection.focus,
      limit(savedSelection.focus, savedSelection.focusOffset),
    );
  }
}
