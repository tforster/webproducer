import Handlebars from "handlebars";

const hbsTemplate = `<ul><#each items><li>{{name}}</li></#each></ul>`;

// Compile with Handlebars
const hbTemplate = Handlebars.compile(hbsTemplate);

// Our render function is defined above
function render(tmpl, ctx) {
  return tmpl.replace(/<#each (\w+)>([\s\S]*?)<\/#each>/g, (match, arrayName, content) => {
    const items = ctx[arrayName];
    const x = items.map((item) => content.replace(/{{(\w+)}}/g, (_, propName) => item[propName])).join("");
    return x;
  });
}

// function compile2(hbsTemplate) {
//   // Extract the part of the template that iterates over the items
//   const pattern = /<#each items>([\s\S]*?)<\/#each>/;
//   const match = hbsTemplate.match(pattern);

//   if (!match) {
//     return () => hbsTemplate; // Return unchanged template if no each block is found
//   }

//   const loopContent = match[1].trim();
//   // Create the inner part of the loop, assuming simple variable substitution like {{propName}}
//   const itemPattern = /{{(\w+)}}/g;
//   const loopTemplate = loopContent.replace(itemPattern, (_, propName) => `\${item.${propName}}`);

//   // Construct the full template literal, inserting the dynamic loop part
//   const fullTemplate = hbsTemplate.replace(pattern, `\${items.map(item => \`${loopTemplate}\`).join('')}`);
//   // return fullTemplate;
// Return a function that evaluates this template with a given context
//   return (context) => eval("`" + fullTemplate + "`");
//   //return `${fullTemplate}`;
//   // return `<ul>${items.map((item) => `<li>${item.name}</li>`)}</ul>`;
// }

function compile(template) {
  // Extract the iterative part of the template
  const eachPattern = /<#each items>([\s\S]*?)<\/#each>/;
  const match = template.match(eachPattern);

  if (!match) {
    return (context) => template; // Return unchanged template if no each block is found
  }

  const loopContent = match[1].trim();
  const itemPattern = /{{(\w+)}}/g;
  const loopTemplate = loopContent.replace(itemPattern, (_, propName) => `\${item.${propName}}`);

  // Replace the custom loop block in the original template with a dynamic expression that will be evaluated later
  const precompiledTemplate = template.replace(eachPattern, `\${context.items.map(item => \`${loopTemplate}\`).join('')}`);

  // Return a function that evaluates this template with a given context
  return function (context) {
    return eval("`" + precompiledTemplate + "`");
  };
}

// const o = compile;

const giTemplate = compile(hbsTemplate);

// function render(ctx) {
//   // Evaluate expressions within the template
//   const evaluate = (str) => {
//     // First, process control structures
//     str = processControlStructures(str);
//     // Then evaluate the template literals
//     return Function(`return \`${str}\`;`).call(context);
//   };

//   return evaluate(hbsTemplate);
// }

// Example template and context for benchmarking
const context = { items: [{ name: "Item 1" }, { name: "Item 2" }, { name: "Item 3" }] };

// Benchmarking function
function benchmark(renderFn, ctx) {
  const startTime = performance.now();
  for (let i = 0; i < 10000; i++) {
    // Adjust iteration count based on needs
    //renderFn(tmpl, ctx);
    const output = renderFn(ctx);
    // console.log(output);
  }
  const endTime = performance.now();
  return endTime - startTime;
}

console.log("Our Engine Time:", benchmark(giTemplate, context));
console.log("Handlebars Time:", benchmark(hbTemplate, context));
