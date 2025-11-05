"use client"

import { cn } from "@/lib/utils";

export const Loader = () => {
  return (
    <>
      <style>{`
        @keyframes loader-rotate {
          0% {
            transform: rotateX(0deg) rotateY(0deg);
          }
          100% {
            transform: rotateX(360deg) rotateY(360deg);
          }
        }
        .loader-cube {
          animation: loader-rotate 3s infinite linear;
        }
      `}</style>
      <div className="wrapper-grid" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: '8px',
        perspective: '1000px'
      }}>
        {['L', 'O', 'A', 'D', 'I', 'N', 'G'].map((letter, index) => (
          <div 
            key={letter}
            className="loader-cube"
            style={{
              width: '50px',
              height: '50px',
              position: 'relative',
              transformStyle: 'preserve-3d',
              animationDelay: `${index * 0.1}s`
            }}
          >
          <div className="face face-front" style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '24px',
            fontWeight: 'bold',
            transform: 'translateZ(25px)'
          }}>{letter}</div>
          <div className="face face-back" style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            transform: 'rotateY(180deg) translateZ(25px)'
          }}></div>
          <div className="face face-right" style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            transform: 'rotateY(90deg) translateZ(25px)'
          }}></div>
          <div className="face face-left" style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            transform: 'rotateY(-90deg) translateZ(25px)'
          }}></div>
          <div className="face face-top" style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            transform: 'rotateX(90deg) translateZ(25px)'
          }}></div>
          <div className="face face-bottom" style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            transform: 'rotateX(-90deg) translateZ(25px)'
          }}></div>
        </div>
      ))}
      </div>
    </>
  );
};
