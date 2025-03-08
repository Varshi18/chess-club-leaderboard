import React from "react";

const AboutUs = () => {
  return (
    <div className="flex flex-col items-center mt-10 py-10 px-6 bg-gray-900 min-h-screen text-white">
      <h2 className="text-4xl font-bold mb-6">About Us</h2>
      <div className="max-w-3xl text-center space-y-6">
        <p className="text-lg text-gray-300">
          Welcome to the IIT Dharwad Chess Club! We are a community of chess enthusiasts who love to play, compete, and improve our game.
        </p>
        <p className="text-lg text-gray-300">
          Our club hosts tournaments, training sessions, and friendly matches throughout the year, bringing together players of all skill levels.
        </p>
        <p className="text-lg text-gray-300">
          Whether you're a beginner looking to learn or an advanced player aiming for mastery, you'll find a place here. Join us and be part of an ever-growing chess community!
        </p>
      </div>
    </div>
  );
};

export default AboutUs;
