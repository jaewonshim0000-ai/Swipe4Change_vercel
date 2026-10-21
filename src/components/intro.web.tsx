import { MotionConfig } from 'motion/react';
import BlurText from './react-bits/BlurText';
import AnimatedContent from './react-bits/AnimatedContent';
import SpotlightCard from './react-bits/SpotlightCard';
import CountUp from './react-bits/CountUp';
import StarBorder from './react-bits/StarBorder';
import { colors } from './theme';
import './intro.css';

export function Intro({ onContinue }: { onContinue: () => void }) {
  return (
    <MotionConfig reducedMotion="user">
      <main className="intro">
        <nav className="intro-nav" aria-label="Introduction">
          <a className="intro-brand" href="/">
            Swipe4Change<span>↗</span>
          </a>
          <button className="intro-link" onClick={onContinue}>
            Explore petitions <span aria-hidden="true">↗</span>
          </button>
        </nav>
        <section className="intro-hero">
          <div className="intro-copy">
            <p className="intro-eyebrow">
              <span /> SMALL ACTIONS. SHARED PROGRESS.
            </p>
            <h1>
              <BlurText text="A little swipe." delay={100} />
              <span className="intro-italic">
                <BlurText text="A bigger change." delay={130} />
              </span>
            </h1>
            <p className="intro-description">
              The place where caring becomes doing. Discover petitions that matter to you, find your
              people, and help move your community forward.
            </p>
            <StarBorder
              className="intro-cta"
              backgroundColor={colors.dark}
              color={colors.pale}
              radius={999}
              onClick={onContinue}
            >
              Find your next cause <span aria-hidden="true">↗</span>
            </StarBorder>
            <p className="intro-note">Start with curiosity. Browse freely.</p>
          </div>
          <AnimatedContent distance={45} duration={1} className="intro-art">
            <div className="intro-orbit" aria-hidden="true" />
            <div className="intro-float">✳ A better place starts with us.</div>
            <SpotlightCard
              theme="light"
              spotlightColor="rgba(137,152,120,0.35)"
              className="intro-petition"
            >
              <div className="intro-scene" aria-hidden="true">
                <span className="intro-sun" />
                <span className="intro-hill one" />
                <span className="intro-hill two" />
                <span className="intro-path" />
                <span className="intro-tree">✳</span>
                <span className="intro-scene-label">OUR SHARED TOMORROW</span>
              </div>
              <div className="intro-card-body">
                <span className="intro-tag">A WORLD OF POSSIBILITY</span>
                <h2>
                  Good things happen
                  <br />
                  when we act together.
                </h2>
                <p>Safer streets. Greener spaces. Stronger communities. Your voice belongs here.</p>
                <div className="intro-card-footer">
                  <span className="intro-avatars" aria-hidden="true">
                    J <b>M</b> <i>S</i>
                  </span>
                  <span>Every voice adds up.</span>
                  <span aria-hidden="true">↗</span>
                </div>
              </div>
            </SpotlightCard>
            <div className="intro-sticker">
              Your voice.
              <br />
              <em>Real possibility.</em> ↗
            </div>
          </AnimatedContent>
        </section>
        <section className="intro-steps" aria-label="How it works">
          {[
            ['01', 'Find what moves you', 'Discover local ideas and causes worth caring about.'],
            ['02', 'Make your voice count', 'Read the request. Choose how you want to take part.'],
            [
              '03',
              'Follow the next step',
              'Stay close to the people and progress behind each cause.',
            ],
          ].map(([number, title, description], index) => (
            <AnimatedContent key={number} delay={index * 0.12}>
              <article>
                <span className="intro-step-number">
                  0<CountUp to={index + 1} duration={1.2} />
                </span>
                <div>
                  <h2>{title}</h2>
                  <p>{description}</p>
                </div>
              </article>
            </AnimatedContent>
          ))}
        </section>
        <footer className="intro-footer">
          <span>Made for people who give a little more.</span>
          <span>Notice. Care. Act. ↗</span>
        </footer>
      </main>
    </MotionConfig>
  );
}
