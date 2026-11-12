import {LazyMotion,MotionConfig} from 'motion/react';
import type {ReactNode} from 'react';
const features=()=>import('../game/motionFeatures').then(m=>m.default);
export function MotionProvider({children}:{children:ReactNode}){return <MotionConfig reducedMotion="user" transition={{type:'spring',stiffness:280,damping:26}}><LazyMotion features={features}>{children}</LazyMotion></MotionConfig>;}
