import fp from 'mostly-func';

const getTask = (keys, activity) => {
  return {
    key: keys.join('.'),
    name: activity.name,
    loop: activity.loop? parseInt(activity.loop) : undefined
  };
};

export const getRecursiveTasks = (keys) => (activities) => {
  return fp.flatten(fp.mapIndexed((activity, index) => {
    if (activity.type === 'single') {
      return getTask([...keys,index], activity);
    } else {
      return [
        getTask([...keys,index], activity),
        ...fp.flatten(getRecursiveTasks([...keys,index])(activity.activities || []))
      ];
    }
  }, activities));
};

export const getRecursiveRequires = (path) => (activities) => {
  return fp.reduce((arr, activity) => {
    if (activity.type === 'single') {
      arr.push(fp.dotPath(path, activity) || []);
    } else {
      arr.push(fp.flatten(getRecursiveRequires(path)(activity.activities || [])));
    }
    return arr;
  }, [], activities);
};

export const getRecursiveRewards = (path) => (activities) => {
  return fp.reduce((arr, activity) => {
    if (activity.type === 'single') {
      return arr.concat(fp.dotPath(path, activity) || []);
    } else {
      return arr.concat(fp.flatten(getRecursiveRewards(path)(activity.activities || [])));
    }
  }, [], activities);
};
