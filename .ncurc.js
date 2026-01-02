module.exports = {
  target: (dependencyName) => {
    if (dependencyName === '@types/node')
      return 'minor';
    return 'latest';
  }
}
