import {useLayoutEffect,useRef,type ReactNode} from 'react';

export function LearningScreen({toolbar,actions,children,className=''}:{toolbar:ReactNode;actions:ReactNode;children:ReactNode;className?:string}) {
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(()=>{
    window.scrollTo(0,0);
    const viewport = window.visualViewport;
    const resize = () => {
      const element = ref.current;
      if(!element)return;
      const top = Math.max(element.getBoundingClientRect().top,viewport?.offsetTop||0);
      const bottom = (viewport?.offsetTop||0)+(viewport?.height||window.innerHeight);
      element.style.setProperty('--study-height',`${Math.max(0,bottom-top)}px`);
    };
    resize();
    window.addEventListener('resize',resize);
    viewport?.addEventListener('resize',resize);
    viewport?.addEventListener('scroll',resize);
    let frame=0;
    const observer = new ResizeObserver(()=>{
      cancelAnimationFrame(frame);
      frame=requestAnimationFrame(resize);
    });
    const header = document.querySelector('.mobile-header');
    if(header)observer.observe(header);
    observer.observe(document.body);
    return()=>{
      window.removeEventListener('resize',resize);
      viewport?.removeEventListener('resize',resize);
      viewport?.removeEventListener('scroll',resize);
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  },[]);
  return <section ref={ref} className={`learning-screen ${className}`}>
    <div className="learning-toolbar">{toolbar}</div>
    <div className="learning-content">{children}</div>
    <div className="learning-actions">{actions}</div>
  </section>;
}
