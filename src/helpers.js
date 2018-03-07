import fp from 'mostly-func';

export const getActivityRequires = (activities) => {
  return fp.reduce((arr, activity) => {
    if (activity.type === 'single') {
      arr.push(activity.requires || []);
    } else {
      arr.push(fp.flatten(getActivityRequires(activity.activities || [])));
    }
    return arr;
  }, [], activities);
};

export const getActivityRewards = (activities) => {
  return fp.reduce((arr, activity) => {
    if (activity.type === 'single') {
      return arr.concat(activity.rewards || []);
    } else {
      return arr.concat(fp.flatten(getActivityRewards(activity.activities || [])));
    }
  }, [], activities);
};