window.addEventListener("load", () => {
  "use strict";
  const
    $id = document.getElementById.bind(document),
    $elm = document.createElement.bind(document);

  const
    Const = Object.freeze({
      MaskedString: "■",
      SymbolCharacters: Object.freeze(new Set(["(", ")", "「", "」", "＋", "×", ".", "：", "●", "、", "。", "－", "・", "＆"])),
    });

  $id("symbols").textContent = Array.from(Const.SymbolCharacters).join("")
  
  class Editor {
    constructor(element) {
      this.#editor = element;
      const
        original = $elm("textarea"),
        maskedContainer = $elm("div");
      original.classList.add("original");
      original.rows = 1;
      maskedContainer.classList.add("masked-container", "normal-mode");
      $id("reverse").addEventListener("click", () => {
        maskedContainer.classList.toggle("normal-mode");
        maskedContainer.classList.toggle("reverse-mode");
      });
      this.#original = original;
      this.#maskedContainer = maskedContainer;
      element.append(original, maskedContainer);
      this.#maskedLines = [new MaskedLine(maskedContainer, "")];
      original.addEventListener("input", () => {
        this.reload(original.value);
      });
    }

    reload(text) {
      const 
        lines = text.split("\n"),
        lineCount = lines.length,
        beforeLength = this.#maskedLines.length,
        maxLineNum = Math.min(beforeLength, lineCount);
      
      let lineNum = 0;
      while (lineNum < maxLineNum && this.#maskedLines[lineNum].original === lines[lineNum]) {
        lineNum += 1;
      }
      const sameLineCountBefore = lineNum;
      //console.log("sameLineCountBefore: " + sameLineCountBefore);
      
      lineNum = 0;
      //console.log(beforeLength);
      //console.log(this.#maskedLines[0]?.original);
      while (lineNum < maxLineNum - sameLineCountBefore && this.#maskedLines[beforeLength - 1 - lineNum].original === lines[lineCount - lineNum]) {
        lineNum += 1;
        console.log(this.#maskedLines[beforeLength - lineNum]?.original);
      }
      const sameLineCountAfter = lineNum;
      
      //console.log("sameLineCountAfter: " + sameLineCountAfter);

      const insertLines = [];
      for (lineNum = sameLineCountBefore; lineNum < lineCount - sameLineCountAfter; lineNum += 1) {
        insertLines.push(new MaskedLine(this.#maskedContainer, lines[lineNum]));
      }
      
      this.splice(sameLineCountBefore, beforeLength - sameLineCountAfter, insertLines);
      //console.log(this.#maskedLines.map((line) => line.original));

      this.#original.rows = lineCount;
    }

    reset() {
      for (const line of this.#maskedLines) {
        line.reset();
      }
    }
    
    maskHiragana() {
      this.#mask(this.#isHiragana);
    }
    
    maskNumber() {
      this.#mask(this.#isNumberCharacter);
    }
    
    maskSymbol() {
      this.#mask(this.#isSymbol);
    }
    
    maskSpace() {
      this.#mask(this.#isSpace);
    }
    
    splice(fromLineNum, toLineNum, lines) {
      console.log(`${ fromLineNum }行目からの${ toLineNum - fromLineNum }行を削除し${ lines.length }行挿入`);
      for (let lineNum = fromLineNum; lineNum < toLineNum; lineNum += 1) {
        this.#maskedLines[lineNum].delete();
      }
      this.#maskedLines.splice(fromLineNum, toLineNum - fromLineNum, ...lines);
    }

    getText() {
      return this.#maskedLines.map((line) => line.getText()).join("\n");
    }

    get editor() {
      return this.#editor;
    }
    
    #createLineFromText(text) {
      return new MaskedLine(text);
    }
    
    #mask(determiner) {
      for (const line of this.#maskedLines) {
        line.mask(determiner);
      }
    }
    
    #isHiragana(character) {
      return 0x3040 <= character.codePointAt(0) && character.codePointAt(0) <= 0x309F;
    }
    
    #isNumberCharacter(character) {
      return (
        0x30 <= character.codePointAt(0) && character.codePointAt(0) <= 0x39
          || (0xFF10 <= character.codePointAt(0) && character.codePointAt(0) <= 0xFF19)
      );
    }
    
    #isSymbol(character) {
      return Const.SymbolCharacters.has(character);
    }
    
    #isSpace(character) {
      return character === " ";
    }
    
    #editor;
    #original;
    #maskedContainer;
    /** @type {MaskedLine[]} */
    #maskedLines;
  }

  class MaskedLine {
    constructor(parent, text) {
      this.#parent = parent;
      const
        element = $elm("div"),
        modes = [];
      element.classList.add("line");
      for (const i of [1, 2]) {
        const textarea = $elm("textarea");
        textarea.readOnly = true;
        textarea.rows = 1;
        textarea.classList.add("masked", `mode${ i - 1 }`);
        textarea.value = text;
        modes[i - 1] = textarea;
        element.appendChild(textarea);
      }
      parent.appendChild(element);
      this.#element = element;
      this.#original = text;
      this.#modes = modes;
      this.#maskPoints = new SortedList();
      element.addEventListener("click", this.#onClick.bind(this));
    }

    delete() {
      this.#parent.removeChild(this.#element);
    }

    reset() {
      this.#maskPoints.reset();
      this.#applyMaskPoints();
    }
    
    mask(determiner) {
      const iMax = this.#original.length;
      if (iMax === 0) {
        return;
      }
      let isAfterTarget = determiner(this.#original[0]);
      if (isAfterTarget) {
          this.#maskPoints.toggle(0);
      }
      for (let i = 1; i < iMax; i += 1) {
        const isTarget = determiner(this.#original[i]);
        if (isAfterTarget ^ isTarget) {
          this.#maskPoints.toggle(i);
        }
        isAfterTarget = isTarget;
      }
      this.#applyMaskPoints();
    }

    getText(isMasked = this.#element.classList.contains("normal-mode")) {
      const results = [];
      let lastIndex = 0;
      for (const index of this.#maskPoints) {
        const text = !isMasked ? this.#original.slice(lastIndex, index)
          : Const.MaskedString.repeat(index - lastIndex);
        results.push(text);
        lastIndex = index;
        isMasked = !isMasked;
      }
      const text = !isMasked ? this.#original.slice(lastIndex, this.#original.length)
        : Const.MaskedString.repeat(this.#original.length - lastIndex);
      results.push(text);
      return results.join("");
    }
    
    get original() { return this.#original; }

    #applyMaskPoints() {
      this.#modes[0].value = this.getText(false);
      this.#modes[1].value = this.getText(true);
    }
    
    #onClick(e) {
      const target = e.target;
      if (target.selectionStart === undefined || target.selectionStart === target.selectionEnd) {
        return;
      }
      this.#maskPoints.toggle(target.selectionStart);
      this.#maskPoints.toggle(target.selectionEnd);
      this.#applyMaskPoints();
    }
    
    #parent;
    #element;
    #modes;
    #original;
    #maskPoints;
  }

  class SortedList {
    constructor() {
      this.#array = [];
    }

    toggle(number) {
      const length = this.#array.length;
      let max = 1;
      while (max < length) {
        max <<= 1;
      }
      const index = this.#getIndex(number, 0, max >> 1);
      if (this.#array[index - 1] === number) {
        this.#array.splice(index - 1, 1);
      }
      else if (this.#array[index] === number) {
        this.#array.splice(index, 1);
      }
      else {
        this.#array.splice(index, 0, number);
      }
    }

    reset() {
      this.#array.length = 0;
    }
    
    [Symbol.iterator]() {
      return this.#array.values();
    }

    #getIndex(target, currentIndex, accuracy) {
      const current = this.#array[currentIndex + accuracy];
      if (accuracy === 0) {
        return (current === undefined || target < current) ? currentIndex : currentIndex + 1;
      }
      return this.#getIndex(target, (current === undefined || target < current) ? currentIndex : currentIndex + accuracy, accuracy >> 1);
    }
    
    #array;
  }
  
  const 
    editorElement = $id("editor"),
    editor = new Editor(editorElement);
  $id("copy").addEventListener("click", () => {
    navigator.clipboard.writeText(editor.getText())
      .then(() => {
        alert("コピー完了！");
      });
  });
  $id("reset").addEventListener("click", () => {
    if (!confirm("伏字状況が失われます。よろしいですか？")) {
      return;
    }
    editor.reset();
  });
  $id("mask-hiragana").addEventListener("click", () => {
    editor.maskHiragana();
  });
  $id("mask-number").addEventListener("click", () => {
    editor.maskNumber();
  });
  $id("mask-symbol").addEventListener("click", () => {
    editor.maskSymbol();
  });
  $id("mask-space").addEventListener("click", () => {
    editor.maskSpace();
  });


  const hoge = new SortedList();
  hoge.toggle(3);
  hoge.toggle(2);
  hoge.toggle(8);
  hoge.toggle(9);
  hoge.toggle(5);
  hoge.toggle(1);
  hoge.toggle(1);
  hoge.toggle(2);
  console.log("loaded");
});