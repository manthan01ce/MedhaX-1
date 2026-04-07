require('dotenv').config();
const db = require('./db');
const bcrypt = require('bcryptjs');

console.log('🌱 Seeding database...\n');

// Seed test users
const users = [
  { username: 'alice', password: 'pass123' },
  { username: 'bob', password: 'pass123' },
  { username: 'charlie', password: 'pass123' },
];

const insertUser = db.prepare('INSERT OR IGNORE INTO users (username, password_hash) VALUES (?, ?)');
for (const u of users) {
  const hash = bcrypt.hashSync(u.password, 10);
  insertUser.run(u.username, hash);
  console.log(`  User: ${u.username} / ${u.password}`);
}

// Seed questions
const questions = [
  // === PYTHON (20) ===
  { cat: 'python', q: 'What is the output of print(type([]))?', a: "<class 'list'>", b: "<class 'array'>", c: "<class 'tuple'>", d: "<class 'dict'>", ans: 'A' },
  { cat: 'python', q: 'Which keyword is used for function definition in Python?', a: 'function', b: 'def', c: 'func', d: 'define', ans: 'B' },
  { cat: 'python', q: 'What does len() function do?', a: 'Returns data type', b: 'Returns length', c: 'Returns max value', d: 'Returns min value', ans: 'B' },
  { cat: 'python', q: 'Which of these is a Python tuple?', a: '[1,2,3]', b: '{1,2,3}', c: '(1,2,3)', d: '<1,2,3>', ans: 'C' },
  { cat: 'python', q: 'How do you start a comment in Python?', a: '//', b: '/*', c: '#', d: '--', ans: 'C' },
  { cat: 'python', q: 'What is the output of 3 ** 2 in Python?', a: '6', b: '9', c: '8', d: '5', ans: 'B' },
  { cat: 'python', q: 'Which method adds an element to a list?', a: 'add()', b: 'push()', c: 'append()', d: 'insert_end()', ans: 'C' },
  { cat: 'python', q: 'What does "pip" stand for?', a: 'Python Install Package', b: 'Pip Installs Packages', c: 'Package In Python', d: 'Python Index Packages', ans: 'B' },
  { cat: 'python', q: 'Which is not a Python data type?', a: 'int', b: 'float', c: 'char', d: 'str', ans: 'C' },
  { cat: 'python', q: 'What is output of bool("")?', a: 'True', b: 'False', c: 'None', d: 'Error', ans: 'B' },
  { cat: 'python', q: 'Which operator is used for floor division?', a: '/', b: '//', c: '%', d: '**', ans: 'B' },
  { cat: 'python', q: 'What does range(5) generate?', a: '1 to 5', b: '0 to 5', c: '0 to 4', d: '1 to 4', ans: 'C' },
  { cat: 'python', q: 'How do you create a dictionary?', a: '[]', b: '()', c: '{}', d: '<>', ans: 'C' },
  { cat: 'python', q: 'What is Python\'s None equivalent to?', a: '0', b: 'false', c: 'null in other languages', d: 'empty string', ans: 'C' },
  { cat: 'python', q: 'Which loop is not in Python?', a: 'for', b: 'while', c: 'do-while', d: 'for-in', ans: 'C' },
  { cat: 'python', q: 'What does strip() do to a string?', a: 'Removes vowels', b: 'Removes whitespace from ends', c: 'Converts to lowercase', d: 'Reverses the string', ans: 'B' },
  { cat: 'python', q: 'How do you handle exceptions in Python?', a: 'try/catch', b: 'try/except', c: 'begin/rescue', d: 'do/catch', ans: 'B' },
  { cat: 'python', q: 'What is a lambda in Python?', a: 'A loop', b: 'A class', c: 'An anonymous function', d: 'A module', ans: 'C' },
  { cat: 'python', q: 'Which built-in function returns sorted list?', a: 'order()', b: 'sort()', c: 'sorted()', d: 'arrange()', ans: 'C' },
  { cat: 'python', q: 'What is the output of "hello"[1]?', a: 'h', b: 'e', c: 'l', d: 'o', ans: 'B' },

  // === JAVASCRIPT (20) ===
  { cat: 'javascript', q: 'Which company developed JavaScript?', a: 'Microsoft', b: 'Netscape', c: 'Google', d: 'Apple', ans: 'B' },
  { cat: 'javascript', q: 'What does === operator do?', a: 'Assignment', b: 'Loose equality', c: 'Strict equality', d: 'Not equal', ans: 'C' },
  { cat: 'javascript', q: 'Which is not a JS data type?', a: 'undefined', b: 'number', c: 'float', d: 'boolean', ans: 'C' },
  { cat: 'javascript', q: 'How do you declare a constant?', a: 'var', b: 'let', c: 'const', d: 'constant', ans: 'C' },
  { cat: 'javascript', q: 'What does JSON stand for?', a: 'Java Source Object Notation', b: 'JavaScript Object Notation', c: 'JavaScript Online Notation', d: 'Java Standard Object Notation', ans: 'B' },
  { cat: 'javascript', q: 'Which method converts JSON to object?', a: 'JSON.parse()', b: 'JSON.stringify()', c: 'JSON.convert()', d: 'JSON.toObject()', ans: 'A' },
  { cat: 'javascript', q: 'What is typeof null?', a: 'null', b: 'undefined', c: 'object', d: 'number', ans: 'C' },
  { cat: 'javascript', q: 'What does NaN stand for?', a: 'Not a Null', b: 'Not a Number', c: 'Null and None', d: 'Number and Null', ans: 'B' },
  { cat: 'javascript', q: 'Which is used for async operations?', a: 'Callbacks', b: 'Promises', c: 'Async/Await', d: 'All of the above', ans: 'D' },
  { cat: 'javascript', q: 'What does Array.push() return?', a: 'The array', b: 'The added element', c: 'New length', d: 'undefined', ans: 'C' },
  { cat: 'javascript', q: 'Which event fires when page loads?', a: 'onchange', b: 'onclick', c: 'onload', d: 'onstart', ans: 'C' },
  { cat: 'javascript', q: 'How to create an object?', a: '[]', b: '()', c: '{}', d: '<>', ans: 'C' },
  { cat: 'javascript', q: 'What is closure in JS?', a: 'A loop', b: 'Function with access to outer scope', c: 'An object', d: 'A class', ans: 'B' },
  { cat: 'javascript', q: 'Which method removes last array element?', a: 'shift()', b: 'pop()', c: 'splice()', d: 'slice()', ans: 'B' },
  { cat: 'javascript', q: 'What does "use strict" do?', a: 'Enables strict mode', b: 'Imports a module', c: 'Defines a class', d: 'Starts a loop', ans: 'A' },
  { cat: 'javascript', q: 'Template literals use which character?', a: 'Single quote', b: 'Double quote', c: 'Backtick', d: 'Forward slash', ans: 'C' },
  { cat: 'javascript', q: 'What is the output of 0.1 + 0.2 === 0.3?', a: 'true', b: 'false', c: 'NaN', d: 'Error', ans: 'B' },
  { cat: 'javascript', q: 'Which is not a loop in JS?', a: 'for', b: 'while', c: 'foreach', d: 'repeat', ans: 'D' },
  { cat: 'javascript', q: 'What does map() return?', a: 'Modified original array', b: 'New array', c: 'undefined', d: 'Boolean', ans: 'B' },
  { cat: 'javascript', q: 'Arrow functions were introduced in?', a: 'ES3', b: 'ES5', c: 'ES6', d: 'ES8', ans: 'C' },

  // === JAVA (20) ===
  { cat: 'java', q: 'Java is a ___ language.', a: 'Procedural', b: 'Object-Oriented', c: 'Functional', d: 'Scripting', ans: 'B' },
  { cat: 'java', q: 'Which is the entry point of a Java program?', a: 'start()', b: 'run()', c: 'main()', d: 'begin()', ans: 'C' },
  { cat: 'java', q: 'What is JVM?', a: 'Java Virtual Machine', b: 'Java Visual Machine', c: 'Java Variable Manager', d: 'Java Version Manager', ans: 'A' },
  { cat: 'java', q: 'Which keyword prevents inheritance?', a: 'static', b: 'private', c: 'final', d: 'abstract', ans: 'C' },
  { cat: 'java', q: 'What is the size of int in Java?', a: '2 bytes', b: '4 bytes', c: '8 bytes', d: '16 bytes', ans: 'B' },
  { cat: 'java', q: 'Which is not a primitive type?', a: 'int', b: 'boolean', c: 'String', d: 'char', ans: 'C' },
  { cat: 'java', q: 'What does the "extends" keyword do?', a: 'Implements interface', b: 'Creates inheritance', c: 'Creates object', d: 'Imports package', ans: 'B' },
  { cat: 'java', q: 'Which collection allows duplicate elements?', a: 'Set', b: 'HashSet', c: 'List', d: 'TreeSet', ans: 'C' },
  { cat: 'java', q: 'What is autoboxing?', a: 'Manual type casting', b: 'Auto conversion of primitive to wrapper', c: 'Creating arrays', d: 'Exception handling', ans: 'B' },
  { cat: 'java', q: 'Which access modifier has widest scope?', a: 'private', b: 'protected', c: 'default', d: 'public', ans: 'D' },
  { cat: 'java', q: 'What does "static" mean?', a: 'Instance level', b: 'Class level', c: 'Package level', d: 'Thread level', ans: 'B' },
  { cat: 'java', q: 'Java supports multiple inheritance through?', a: 'Classes', b: 'Interfaces', c: 'Abstract classes', d: 'Packages', ans: 'B' },
  { cat: 'java', q: 'Which exception is checked?', a: 'NullPointerException', b: 'IOException', c: 'ArithmeticException', d: 'ArrayIndexOutOfBounds', ans: 'B' },
  { cat: 'java', q: 'What is a constructor?', a: 'A method that returns void', b: 'A method called when object is created', c: 'A static method', d: 'A loop structure', ans: 'B' },
  { cat: 'java', q: 'Which keyword creates an object?', a: 'create', b: 'object', c: 'new', d: 'malloc', ans: 'C' },
  { cat: 'java', q: 'What is the parent class of all classes?', a: 'Class', b: 'Object', c: 'Root', d: 'Parent', ans: 'B' },
  { cat: 'java', q: 'Which is a valid array declaration?', a: 'int arr[]', b: 'int[] arr', c: 'Both A and B', d: 'Neither', ans: 'C' },
  { cat: 'java', q: 'What does "break" do in a loop?', a: 'Skips iteration', b: 'Exits loop', c: 'Pauses loop', d: 'Restarts loop', ans: 'B' },
  { cat: 'java', q: 'Which is an immutable class?', a: 'StringBuilder', b: 'StringBuffer', c: 'String', d: 'ArrayList', ans: 'C' },
  { cat: 'java', q: 'What is polymorphism?', a: 'One name, many forms', b: 'Data hiding', c: 'Code reuse', d: 'Memory management', ans: 'A' },

  // === C++ (15) ===
  { cat: 'cpp', q: 'C++ was developed by?', a: 'Dennis Ritchie', b: 'Bjarne Stroustrup', c: 'James Gosling', d: 'Guido van Rossum', ans: 'B' },
  { cat: 'cpp', q: 'Which operator is used for scope resolution?', a: '.', b: '->', c: '::', d: '#', ans: 'C' },
  { cat: 'cpp', q: 'What is a pointer?', a: 'A variable storing address', b: 'A function', c: 'A class', d: 'A loop', ans: 'A' },
  { cat: 'cpp', q: 'Which is used for dynamic memory?', a: 'malloc', b: 'new', c: 'Both A and B', d: 'Neither', ans: 'C' },
  { cat: 'cpp', q: 'What does virtual keyword enable?', a: 'Polymorphism', b: 'Encapsulation', c: 'Abstraction', d: 'Inheritance', ans: 'A' },
  { cat: 'cpp', q: 'Which is not a C++ access specifier?', a: 'public', b: 'private', c: 'protected', d: 'internal', ans: 'D' },
  { cat: 'cpp', q: 'What is the correct file extension?', a: '.c', b: '.cpp', c: '.java', d: '.py', ans: 'B' },
  { cat: 'cpp', q: 'STL stands for?', a: 'Standard Template Library', b: 'System Template Library', c: 'Standard Type Library', d: 'Simple Template Language', ans: 'A' },
  { cat: 'cpp', q: 'What is an abstract class?', a: 'Class with all static methods', b: 'Class with at least one pure virtual function', c: 'Class with no methods', d: 'Final class', ans: 'B' },
  { cat: 'cpp', q: 'Which header is needed for cout?', a: '<stdio.h>', b: '<iostream>', c: '<string>', d: '<conio.h>', ans: 'B' },
  { cat: 'cpp', q: 'What is operator overloading?', a: 'Defining new operators', b: 'Giving operators new meaning for UDTs', c: 'Removing operators', d: 'None', ans: 'B' },
  { cat: 'cpp', q: 'What is a destructor?', a: 'Initializes object', b: 'Destroys object when out of scope', c: 'Creates copy', d: 'Allocates memory', ans: 'B' },
  { cat: 'cpp', q: 'Which container has O(1) access?', a: 'list', b: 'map', c: 'vector', d: 'set', ans: 'C' },
  { cat: 'cpp', q: 'What does const after method mean?', a: 'Cannot be called', b: 'Does not modify object', c: 'Returns constant', d: 'Is static', ans: 'B' },
  { cat: 'cpp', q: 'What is RAII?', a: 'Resource Acquisition Is Initialization', b: 'Runtime Allocated Integer Indexing', c: 'Random Access Internal Iterator', d: 'Read Access Input Interface', ans: 'A' },

  // === DSA (20) ===
  { cat: 'dsa', q: 'What is the time complexity of binary search?', a: 'O(n)', b: 'O(log n)', c: 'O(n²)', d: 'O(1)', ans: 'B' },
  { cat: 'dsa', q: 'Which data structure uses LIFO?', a: 'Queue', b: 'Stack', c: 'Array', d: 'Linked List', ans: 'B' },
  { cat: 'dsa', q: 'Which data structure uses FIFO?', a: 'Stack', b: 'Queue', c: 'Tree', d: 'Graph', ans: 'B' },
  { cat: 'dsa', q: 'What is the worst case of QuickSort?', a: 'O(n log n)', b: 'O(n)', c: 'O(n²)', d: 'O(log n)', ans: 'C' },
  { cat: 'dsa', q: 'Which is the fastest sorting algorithm on average?', a: 'Bubble Sort', b: 'Merge Sort', c: 'Selection Sort', d: 'Insertion Sort', ans: 'B' },
  { cat: 'dsa', q: 'What is a balanced BST?', a: 'All leaves at same level', b: 'Height difference ≤ 1', c: 'Complete binary tree', d: 'Full binary tree', ans: 'B' },
  { cat: 'dsa', q: 'Hash table average lookup is?', a: 'O(n)', b: 'O(log n)', c: 'O(1)', d: 'O(n²)', ans: 'C' },
  { cat: 'dsa', q: 'Which traversal gives sorted order of BST?', a: 'Preorder', b: 'Postorder', c: 'Inorder', d: 'Level order', ans: 'C' },
  { cat: 'dsa', q: 'What does DFS stand for?', a: 'Direct First Search', b: 'Depth First Search', c: 'Data Flow System', d: 'Directed Forward Search', ans: 'B' },
  { cat: 'dsa', q: 'What is a heap?', a: 'Linear structure', b: 'Complete binary tree with heap property', c: 'Hash table variant', d: 'Graph type', ans: 'B' },
  { cat: 'dsa', q: 'Linked list insertion at head is?', a: 'O(n)', b: 'O(log n)', c: 'O(1)', d: 'O(n²)', ans: 'C' },
  { cat: 'dsa', q: 'Which algorithm finds shortest path?', a: 'DFS', b: 'Dijkstra', c: 'Merge Sort', d: 'Binary Search', ans: 'B' },
  { cat: 'dsa', q: 'What is a graph cycle?', a: 'A path that starts and ends at same vertex', b: 'An edge', c: 'A tree', d: 'A level', ans: 'A' },
  { cat: 'dsa', q: 'Max elements in a binary tree of height h?', a: 'h', b: '2^h', c: '2^(h+1) - 1', d: 'h²', ans: 'C' },
  { cat: 'dsa', q: 'Which is not a graph representation?', a: 'Adjacency matrix', b: 'Adjacency list', c: 'Edge list', d: 'Node stack', ans: 'D' },
  { cat: 'dsa', q: 'What is dynamic programming?', a: 'Dividing into subproblems with memoization', b: 'Random search', c: 'Brute force', d: 'Graph traversal', ans: 'A' },
  { cat: 'dsa', q: 'Best case of bubble sort is?', a: 'O(n²)', b: 'O(n log n)', c: 'O(n)', d: 'O(1)', ans: 'C' },
  { cat: 'dsa', q: 'What is a trie used for?', a: 'Sorting', b: 'String prefix searching', c: 'Graph traversal', d: 'Hashing', ans: 'B' },
  { cat: 'dsa', q: 'Space complexity of merge sort?', a: 'O(1)', b: 'O(log n)', c: 'O(n)', d: 'O(n²)', ans: 'C' },
  { cat: 'dsa', q: 'Which data structure is used in BFS?', a: 'Stack', b: 'Queue', c: 'Heap', d: 'Array', ans: 'B' },

  // === DBMS (15) ===
  { cat: 'dbms', q: 'What does SQL stand for?', a: 'Structured Query Language', b: 'Simple Query Language', c: 'Standard Question Language', d: 'System Query Logic', ans: 'A' },
  { cat: 'dbms', q: 'Which is not a type of SQL command?', a: 'DDL', b: 'DML', c: 'DCL', d: 'DPL', ans: 'D' },
  { cat: 'dbms', q: 'What is a primary key?', a: 'Any column', b: 'Unique identifier for rows', c: 'Foreign reference', d: 'Index', ans: 'B' },
  { cat: 'dbms', q: 'What does ACID stand for in databases?', a: 'Atomicity Consistency Isolation Durability', b: 'Advanced Computing In Databases', c: 'Automated Control Input Data', d: 'Applied Clustering Index Design', ans: 'A' },
  { cat: 'dbms', q: 'Which normal form removes partial dependency?', a: '1NF', b: '2NF', c: '3NF', d: 'BCNF', ans: 'B' },
  { cat: 'dbms', q: 'What is a foreign key?', a: 'Primary key of same table', b: 'Reference to primary key of another table', c: 'Unique constraint', d: 'Index', ans: 'B' },
  { cat: 'dbms', q: 'Which join returns all rows from both tables?', a: 'INNER JOIN', b: 'LEFT JOIN', c: 'FULL OUTER JOIN', d: 'CROSS JOIN', ans: 'C' },
  { cat: 'dbms', q: 'What is normalization?', a: 'Adding redundancy', b: 'Reducing redundancy', c: 'Creating indexes', d: 'Backing up data', ans: 'B' },
  { cat: 'dbms', q: 'Which command deletes a table?', a: 'DELETE', b: 'REMOVE', c: 'DROP', d: 'TRUNCATE', ans: 'C' },
  { cat: 'dbms', q: 'What does GROUP BY do?', a: 'Sorts data', b: 'Groups rows with same values', c: 'Joins tables', d: 'Filters data', ans: 'B' },
  { cat: 'dbms', q: 'What is an index?', a: 'Primary key', b: 'Data structure for fast lookup', c: 'Table constraint', d: 'View', ans: 'B' },
  { cat: 'dbms', q: 'Which is a DML command?', a: 'CREATE', b: 'ALTER', c: 'INSERT', d: 'DROP', ans: 'C' },
  { cat: 'dbms', q: 'What is a view?', a: 'Physical table', b: 'Virtual table from query', c: 'Index type', d: 'Backup', ans: 'B' },
  { cat: 'dbms', q: 'What is a transaction?', a: 'A single SQL query', b: 'A unit of work that is atomic', c: 'A table', d: 'A connection', ans: 'B' },
  { cat: 'dbms', q: 'What is deadlock?', a: 'Fast execution', b: 'Two transactions waiting for each other', c: 'Data corruption', d: 'Index failure', ans: 'B' },

  // === OS (15) ===
  { cat: 'os', q: 'What does OS stand for?', a: 'Open Software', b: 'Operating System', c: 'Output System', d: 'Online Service', ans: 'B' },
  { cat: 'os', q: 'Which is not an OS?', a: 'Windows', b: 'Linux', c: 'Oracle', d: 'macOS', ans: 'C' },
  { cat: 'os', q: 'What is a process?', a: 'A file', b: 'A program in execution', c: 'A thread', d: 'A command', ans: 'B' },
  { cat: 'os', q: 'What does CPU scheduling decide?', a: 'Memory allocation', b: 'Which process runs next', c: 'File management', d: 'Network routing', ans: 'B' },
  { cat: 'os', q: 'What is virtual memory?', a: 'RAM', b: 'Using disk as extended memory', c: 'Cache', d: 'ROM', ans: 'B' },
  { cat: 'os', q: 'What is a semaphore?', a: 'A process', b: 'Synchronization tool', c: 'Memory type', d: 'File system', ans: 'B' },
  { cat: 'os', q: 'Which scheduling is non-preemptive?', a: 'Round Robin', b: 'FCFS', c: 'SRTF', d: 'Priority (preemptive)', ans: 'B' },
  { cat: 'os', q: 'What is thrashing?', a: 'Fast execution', b: 'Excessive paging', c: 'Process creation', d: 'File deletion', ans: 'B' },
  { cat: 'os', q: 'What is a thread?', a: 'A program', b: 'Lightweight process', c: 'A file', d: 'A command', ans: 'B' },
  { cat: 'os', q: 'What is paging?', a: 'Memory management scheme', b: 'CPU scheduling', c: 'File management', d: 'Network protocol', ans: 'A' },
  { cat: 'os', q: 'Which is a page replacement algorithm?', a: 'FCFS', b: 'LRU', c: 'SJF', d: 'Round Robin', ans: 'B' },
  { cat: 'os', q: 'What is a mutex?', a: 'A thread', b: 'Mutual exclusion lock', c: 'A process', d: 'A memory unit', ans: 'B' },
  { cat: 'os', q: 'What is context switching?', a: 'Changing user', b: 'Saving/restoring process state', c: 'Deleting process', d: 'Creating thread', ans: 'B' },
  { cat: 'os', q: 'What is starvation?', a: 'Process getting too much CPU', b: 'Process never getting CPU', c: 'Memory overflow', d: 'Disk full', ans: 'B' },
  { cat: 'os', q: 'What is the kernel?', a: 'User interface', b: 'Core of the OS', c: 'An application', d: 'A file system', ans: 'B' },

  // === OOP (15) ===
  { cat: 'oop', q: 'What are the four pillars of OOP?', a: 'Array, Loop, Function, Variable', b: 'Encapsulation, Abstraction, Inheritance, Polymorphism', c: 'Class, Object, Method, Property', d: 'Input, Process, Output, Storage', ans: 'B' },
  { cat: 'oop', q: 'What is encapsulation?', a: 'Code reuse', b: 'Data hiding with bundling', c: 'Multiple inheritance', d: 'Function overloading', ans: 'B' },
  { cat: 'oop', q: 'What is inheritance?', a: 'Creating objects', b: 'Deriving new class from existing', c: 'Hiding data', d: 'Method overloading', ans: 'B' },
  { cat: 'oop', q: 'Method overloading is an example of?', a: 'Runtime polymorphism', b: 'Compile-time polymorphism', c: 'Inheritance', d: 'Encapsulation', ans: 'B' },
  { cat: 'oop', q: 'Method overriding is an example of?', a: 'Compile-time polymorphism', b: 'Runtime polymorphism', c: 'Abstraction', d: 'Encapsulation', ans: 'B' },
  { cat: 'oop', q: 'What is an abstract class?', a: 'Class that cannot be instantiated directly', b: 'A final class', c: 'A static class', d: 'A singleton class', ans: 'A' },
  { cat: 'oop', q: 'What is an interface?', a: 'A class with implementations', b: 'A contract with method signatures', c: 'A variable', d: 'A loop', ans: 'B' },
  { cat: 'oop', q: 'What is a constructor?', a: 'A destructor', b: 'Auto-called method on object creation', c: 'A static method', d: 'A getter', ans: 'B' },
  { cat: 'oop', q: 'What is composition in OOP?', a: 'Inheriting from parent', b: 'Object containing other objects', c: 'Method overriding', d: 'Data hiding', ans: 'B' },
  { cat: 'oop', q: 'What is the diamond problem?', a: 'Memory leak', b: 'Ambiguity in multiple inheritance', c: 'Stack overflow', d: 'Type mismatch', ans: 'B' },
  { cat: 'oop', q: 'What does "this" keyword refer to?', a: 'Parent class', b: 'Current object instance', c: 'Static context', d: 'Global scope', ans: 'B' },
  { cat: 'oop', q: 'What is a singleton pattern?', a: 'Multiple instances class', b: 'Class with only one instance', c: 'Abstract class', d: 'Interface', ans: 'B' },
  { cat: 'oop', q: 'What is coupling in OOP?', a: 'Code readability', b: 'Degree of dependency between classes', c: 'Memory usage', d: 'CPU usage', ans: 'B' },
  { cat: 'oop', q: 'Tight coupling is generally?', a: 'Desired', b: 'Undesired', c: 'Neither', d: 'Only for small projects', ans: 'B' },
  { cat: 'oop', q: 'What is cohesion?', a: 'Dependency between modules', b: 'How well a class does a single task', c: 'Memory management', d: 'Thread safety', ans: 'B' },
];

// Clear existing questions and insert
db.prepare('DELETE FROM questions').run();

const insertQ = db.prepare(`
  INSERT INTO questions (category, difficulty, question_text, option_a, option_b, option_c, option_d, correct_answer)
  VALUES (?, 'medium', ?, ?, ?, ?, ?, ?)
`);

const insertAll = db.transaction((qs) => {
  for (const q of qs) {
    insertQ.run(q.cat, q.q, q.a, q.b, q.c, q.d, q.ans);
  }
});

insertAll(questions);

console.log(`\n✅ Seeded ${users.length} users and ${questions.length} questions`);
console.log('\nCategories:', [...new Set(questions.map(q => q.cat))].join(', '));
console.log('\nTest credentials:');
users.forEach(u => console.log(`  ${u.username} / ${u.password}`));
console.log('');
