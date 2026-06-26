#!/usr/bin/env node
/**
 * write-artifact.js —— venture pipeline 产物落盘受控（hcc 目录统一阶段4 Task 1）
 *
 * agent 调本脚本写节点产物，路径由 dag node exit_condition 决定（不 agent 自由落盘）。
 * 配合 set-signal --artifact endsWith exit_condition 校验（Task 4），形成"写受控 + 校验堵漏"闭环。
 *
 * 接口：node write-artifact.js --node <id> --in <content-file> --dag <path>
 *   --node    节点 id（如 N1）
 *   --in      内容文件（agent 生成的内容写到临时文件，脚本读到规定路径）
 *   --dag     dag 路径（读 node exit_condition 提取规定 artifact 路径）
 *
 * 路径来源：extractArtifact(node.exit_condition)（复用 venture-resume.js，三路径 .hcc/.venture/docs/）
 * 约束 C2：纯 fs+path，复用 venture-resume extractArtifact（同 skill require）。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { extractArtifact } = require('./venture-resume.js');

function readDagObj(dagPath) {
  return JSON.parse(fs.readFileSync(dagPath, 'utf8'));
}

function parseArgs(argv) {
  const opts = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--node') opts.node = argv[++i];
    else if (argv[i] === '--in') opts.inFile = argv[++i];
    else if (argv[i] === '--dag') opts.dag = argv[++i];
  }
  return opts;
}

function main() {
  const opts = parseArgs(process.argv);
  if (!opts.node || !opts.inFile || !opts.dag) {
    console.error('用法：node write-artifact.js --node <id> --in <content-file> --dag <path>');
    process.exit(1);
  }
  const dag = readDagObj(opts.dag);
  const node = dag.nodes.find((n) => n.id === opts.node);
  if (!node) {
    console.error(`节点 ${opts.node} 不存在（dag ${opts.dag}）`);
    process.exit(1);
  }
  const targetRel = extractArtifact(node.exit_condition);
  if (!targetRel) {
    console.error(`节点 ${opts.node} exit_condition 无 artifact 路径（placeholder 节点？）`);
    process.exit(1);
  }
  const targetAbs = path.resolve(targetRel);  // 相对 cwd
  const content = fs.readFileSync(opts.inFile, 'utf8');
  fs.mkdirSync(path.dirname(targetAbs), { recursive: true });
  fs.writeFileSync(targetAbs, content, 'utf8');
  process.stdout.write(JSON.stringify({
    ok: true,
    command: 'write-artifact',
    node: opts.node,
    path: targetRel,
    bytes: Buffer.byteLength(content, 'utf8'),
  }, null, 2) + '\n');
  process.exit(0);
}

if (require.main === module) main();

module.exports = { main, parseArgs };
