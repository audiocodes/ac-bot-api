export default {
  cooldown: 1,
  target: (dependencyName) => {
    if (dependencyName === '@types/node')
      return 'minor';
    return 'latest';
  }
};
