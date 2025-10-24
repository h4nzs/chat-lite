Maximum update depth exceeded. This can happen when a component calls setState inside useEffect, but useEffect either doesn't have a dependency array, or one of the dependencies changes on every render. react-dom-client.development.js:3867:17
Uncaught Error: Maximum update depth exceeded. This can happen when a component repeatedly calls setState inside componentWillUpdate or componentDidUpdate. React limits the number of nested updates to prevent infinite loops.
    React 4
    composedRefs focus-scope.tsx:60
    setRef compose-refs.tsx:11
    cleanups compose-refs.tsx:25
    composeRefs compose-refs.tsx:24
    setRef compose-refs.tsx:11
react-dom-client.development.js:3860:11
An error occurred in the <div> component.

Consider adding an error boundary to your tree to customize error handling behavior.
Visit https://react.dev/link/error-boundaries to learn more about error boundaries.
react-dom-client.development.js:8283:15
