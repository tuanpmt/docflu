---
sidebar_position: 1
title: Tutorial Intro
---

# Tutorial Intro

Let's discover **Docusaurus in less than 5 minutes**.

## Getting Started

Get started by **creating a new site**.

Or **try Docusaurus immediately** with **[docusaurus.new](https://docusaurus.new)**.

### What you'll need

- [Node.js](https://nodejs.org/en/download/) version 16.14 or above:
  - When installing Node.js, you are recommended to check all checkboxes related to dependencies.

## Generate a new site

Generate a new Docusaurus site using the **classic template**.

The classic template will automatically be added to your project after you run the command:

```bash
npm create docusaurus@latest my-website classic
```

You can type this command into Command Prompt, Powershell, Terminal, or any other integrated terminal of your code editor.

## Start your site

Run the development server:

```bash
cd my-website
npm run start
```

The `cd` command changes the directory you're working with. In order to work with your newly created Docusaurus site, you'll need to navigate the terminal there.

## Mermaid Diagram Example

Here's a simple Mermaid flowchart showing the setup process:

```mermaid
flowchart TD
    A[Install Node.js] --> B[Create new site]
    B --> C[Navigate to directory]
    C --> D[Run npm start]
    D --> E[Site running on localhost:3000]
    E --> F{Happy with setup?}
    F -->|Yes| G[Start developing]
    F -->|No| H[Check documentation]
    H --> B
```

## PlantUML Sequence Diagram

Here's how the development process works:

```plantuml
@startuml
participant Developer
participant "Docusaurus CLI" as CLI
participant "Dev Server" as Server
participant Browser

Developer -> CLI: npm create docusaurus@latest
CLI -> CLI: Download template
CLI -> Developer: Site created

Developer -> CLI: npm run start
CLI -> Server: Start development server
Server -> Browser: Serve site on localhost:3000
Browser -> Developer: Display site

Developer -> Developer: Edit markdown files
Developer -> Server: Save changes
Server -> Browser: Hot reload
Browser -> Developer: Show updated content
@enduml
```

## Architecture Diagram

```dot
digraph architecture {
    rankdir=TB;
    node [shape=box, style=rounded];
    
    subgraph cluster_source {
        label="Source Files";
        style=filled;
        color=lightgrey;
        
        MD [label="Markdown Files"];
        React [label="React Components"];
        Config [label="docusaurus.config.js"];
    }
    
    subgraph cluster_build {
        label="Build Process";
        style=filled;
        color=lightblue;
        
        Parser [label="Markdown Parser"];
        Bundler [label="Webpack Bundler"];
        Generator [label="Static Site Generator"];
    }
    
    subgraph cluster_output {
        label="Output";
        style=filled;
        color=lightgreen;
        
        HTML [label="Static HTML"];
        CSS [label="CSS Files"];
        JS [label="JavaScript"];
    }
    
    MD -> Parser;
    React -> Bundler;
    Config -> Generator;
    Parser -> Generator;
    Bundler -> Generator;
    Generator -> HTML;
    Generator -> CSS;
    Generator -> JS;
}
```

## D2 System Overview

```d2
# Docusaurus Architecture
docs: {
  shape: rectangle
  label: "Documentation Files"
}

docusaurus: {
  shape: hexagon
  label: "Docusaurus Core"
}

build: {
  shape: diamond
  label: "Build Process"
}

output: {
  shape: cylinder
  label: "Static Site"
}

docs -> docusaurus: "Process"
docusaurus -> build: "Generate"
build -> output: "Deploy"

output -> browser: "Serve"
browser: {
  shape: person
  label: "User Browser"
}
```

That's it! Your site is now running and ready for development. 