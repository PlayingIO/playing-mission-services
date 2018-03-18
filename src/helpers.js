import fp from 'mostly-func';

const getTask = (tasks, keys, activity) => {
  const task = fp.path(keys, tasks);
  const key = keys.join('.');
  const name = activity.name;
  let state = 'ready';
  let loop = undefined;
  if (task && name === task.name) { // check name with key
    state = 'completed';
    if (task.loop && activity.loop) { // if looped task
      loop = task.loop;
      if (task.loop < parseInt(activity.loop)) {
        state = 'active';
      }
    }
    return { key, name, state, loop };
  } else {
    return null;
  }
};

export const walkRecursiveTasks = (tasks, keys, previous = null) => (activities) => {
  return fp.reduceIndexed((acc, activity, index) => {
    const task = getTask(tasks, [...keys,index], activity, previous);
    if (task) {
      switch (activity.type) {
        case 'single':
          acc = acc.concat([task]);
          break;
        case 'sequential': {
          acc = acc.concat(walkRecursiveTasks(tasks, [...keys,index])(activity.activities || []));
          break;
        }
      }
    }
    return acc;
  }, [], activities);
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
