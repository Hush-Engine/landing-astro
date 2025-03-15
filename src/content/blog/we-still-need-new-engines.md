---
title: 'Yes, we still need new game engines'
date: 2025-01-15
draft: false
tags: ['gamedev', 'enginedev', 'opinion']
thumbnail: 'https://europe1.discourse-cdn.com/unity/original/4X/a/5/3/a531c4fc9806891a56fd158017edf738a56ea289.png'
slug: 'we-still-need-new-engines'
author: 'Leónidas Neftalí González Campos'
---

# Yes, we still need new game engines

Going around the internet, a couple days ago I stumbled upon a very interesting project, a newly released game engine called [Cave](https://unidaystudio.itch.io/cave-engine) by UniDay Studios, it is an editor-based 3D engine made in C++ with Python scripting. The implementation honestly surprised me, it seemed very well made, and feature rich. This is a short list of things the devs were able to create all in an executable that is less than 30MB...

- #### 3D editor
- #### Animation system
- #### Entity templates (prefabs)
- #### Python scripting (with an underlying C++ native API)

<br>

This is of course, not the end of what it can do, but I find that those are remarkable features and gives you enough to create 3D games without the bloat that engines like Unity or Unreal contain.
<sub>_I swear this is not an ad for Cave, but do check them out, they worked for 9 years developing this technology_</sub>

![Cave Editor Image](https://img.itch.zone/aW1hZ2UvOTE2MTgwLzE5MDk1NzEyLnBuZw==/original/4HhPx7.png)

All of this impressive stuff, and yet, its release is facing some **HUGE** backslash, but why? Well... a couple reasons, actually, not the least of which being the fact that, well, Unity, Unreal and Godot already exist, so, why even bother to make what is ultimately going to be an objectively inferior product? _(spoilers: this is an inherently flawed line of reasoning)_

## Do not reinvent the wheel

Ok, if we compare Unity to Cave, or any other "indie" game engine, the commercial mainstream options are richer in the number of features they provide, as well as far more developed communities around their specific technologies, so they should seem like a better option, but as time often proves, **more stuff != better product** and we at HushEngine, along with an increasing number people in the software development industry, grow skeptical of bloated and complex software solutions. And I do think that this issue is slowing down game development by tampering with the devs productivity... If my engine takes 5 minutes to complete random "operations" every time it starts up, as a gamedev I'm going to absolutely dread the thought of even opening the project, no matter how passionate I am about it.

And I do wish that I was exagerating here, the reality is, I might even be underestimating just how long Unity takes to do random bullshit.

<table>
  <tr>
    <td style="width: 50%; padding: 5px;">
      <img src="/img/unity-load-search.png" style="width: 100%;">
    </td>
    <td style="width: 50%; padding: 5px;">
      <img src="https://preview.redd.it/5mn4n3lru7381.png?auto=webp&s=c6c9ed4d8c7e722a1e627db03d6b001b0f5d68d7" style="width: 100%;">
    </td>
  </tr>
</table>

Here's the part where I would love to say that Godot came in and fixed these issues, a lightweight engine that takes a matter of seconds to load, isn't overly complex, and is even fun to make stuff in! But again, the harsh truth is that (and I say this as a professional Godot developer that's got love for the engine and its vision), Godot has a lot of problems, specially in its internal architecture, game making workflow (that damned node system), and questionable philosophy regarding integration of third party solutions (i.e. preferring the HttpRequestNode system over more suitable solutions for high performance use cases such as a libcurl client).

And I won't even dare touch the topic of the development workflow in UnrealEngine...

So, what to do if I like the design patterns and architecture of making a game in Unity (i.e ECS), but absolutely despise the amount of useless crap that comes with it? Well, the simple answer would be to deal with it, but a better answer is to learn another engine, and sometimes, the answer is just to build your own.

![Falco Engine](https://i.ytimg.com/vi/ABrzhl2F3yg/maxresdefault.jpg)
<sub>_[Falco Engine](https://falco3d.com/), another 3D Game Engine with C# scripting for those familiar with Unity_</sub>

People act like games have always been made with these tools, you're either team Unity, Godot or UE, and I'm serious, most game development content online is catered not to engine agnostic concepts, like, Vector math and time stepping, no, it's always **HOW TO MOVE YOUR PLAYER IN {INSERT_GAME_ENGINE} IN AN EASY WAY!!! WITH ONLY 3 LINES OF CODE**, which makes me very sad that we're wasting time worrying more about what specific function does the thing that the devs want, instead of learning how to achieve it on our own by understanding the underlying math and game related systems that make that function possible. And this is a real fear I have for the industry, we've seen this before, **we're turning into web developers** experts in React, clueless in computer science.

## We can still save ourselves!

Games in the past have been made in a very different way, not with engines and fancy tools, but rather, a thin abstraction of a graphics and input API, and honestly, not much more than that. Just rawdogging gameplay code and building editing systems as internal tooling, in this sense, the line between game and game engine becomes very blurry, this is often how early game "engines" were made, just a collection of libraries and code samples that were used on a previous game entry and proved themselves useful and quite hard to reimplement (think, the renderer, audio and math libraries, utility functions to interact with the OS, etc.).

I have faith in the recent uprising in custom technologies such as the one presented by engines like Cave, and hopefully, when the time comes Hush. This new wave of proposals I believe can be very beneficial for the gamedev community, as indies have been stuck in this weird limbo, where you have essentially just two, at most three options, this makes games all feel the exact same, because, let's face it, there are many devs that don't bother pushing or customizing their default "looks", having more variety in the market will at least provide an alternatative path for those interested in trying a different workflow, a different rendering approach, a different language, or a different arquitechture... making a different game.
