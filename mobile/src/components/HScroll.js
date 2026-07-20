// Horizontal ScrollView that is actually usable on web. RN-web renders a
// horizontal scroll container, but with scrollbars hidden globally (App.js)
// a mouse user has NO way to move it: dragging doesn't scroll and the
// wheel only fires vertical deltas. On web this maps the wheel's dominant
// axis onto scrollLeft and adds drag-to-scroll (suppressing the click a
// real drag would otherwise fire on a card). On native it's a plain
// horizontal ScrollView — touch already works there.
import React, { useEffect, useRef } from "react";
import { ScrollView, Platform } from "react-native";

export default function HScroll(props) {
  const scrollRef = useRef(null);
  const suppressClick = useRef(false);

  useEffect(() => {
    if (Platform.OS !== "web") return undefined;
    const node = scrollRef.current?.getScrollableNode?.();
    if (!node) return undefined;

    const onWheel = (event) => {
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      if (delta === 0 || node.scrollWidth <= node.clientWidth) return;
      node.scrollLeft += delta;
      event.preventDefault();
    };

    let drag = null;
    const onPointerDown = (event) => {
      drag = { x: event.clientX, left: node.scrollLeft, moved: false };
    };
    const onPointerMove = (event) => {
      if (!drag || event.buttons !== 1) return;
      const dx = event.clientX - drag.x;
      if (Math.abs(dx) > 5) drag.moved = true;
      if (drag.moved) node.scrollLeft = drag.left - dx;
    };
    const onPointerUp = () => {
      if (drag?.moved) suppressClick.current = true;
      drag = null;
    };
    // Capture-phase: swallow the click that follows a drag so releasing
    // over a card doesn't select it.
    const onClick = (event) => {
      if (suppressClick.current) {
        suppressClick.current = false;
        event.stopPropagation();
        event.preventDefault();
      }
    };

    node.addEventListener("wheel", onWheel, { passive: false });
    node.addEventListener("pointerdown", onPointerDown);
    node.addEventListener("click", onClick, true);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      node.removeEventListener("wheel", onWheel);
      node.removeEventListener("pointerdown", onPointerDown);
      node.removeEventListener("click", onClick, true);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, []);

  return <ScrollView ref={scrollRef} horizontal showsHorizontalScrollIndicator={false} {...props} />;
}
