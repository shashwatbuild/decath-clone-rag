"""Parse product data out of a decathlon.in PDP HTML without executing any JS."""
import re, sys, json


class P:
    def __init__(s, t, i=0):
        s.t, s.i = t, i

    def ws(s):
        while s.i < len(s.t) and s.t[s.i] in ' \n\r\t':
            s.i += 1

    def val(s):
        s.ws()
        c = s.t[s.i]
        if c == '{':
            return s.obj()
        if c == '[':
            return s.arr()
        if c in '"\'':
            return s.string()
        m = re.match(r'-?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?', s.t[s.i:])
        if m and (c.isdigit() or c in '-.'):
            s.i += m.end()
            x = m.group(0)
            return float(x) if any(k in x for k in '.e') else int(x)
        m = re.match(r'[A-Za-z_$][\w$]*', s.t[s.i:])
        s.i += m.end()
        w = m.group(0)
        if w == 'void':  # void 0
            s.ws(); s.val()
        return {'true': True, 'false': False}.get(w, None)

    def string(s):
        q = s.t[s.i]
        s.i += 1
        out = []
        while s.t[s.i] != q:
            if s.t[s.i] == '\\':
                n = s.t[s.i + 1]
                if n == 'u':
                    out.append(chr(int(s.t[s.i + 2:s.i + 6], 16)))
                    s.i += 6
                    continue
                out.append({'n': '\n', 't': '\t', 'r': ''}.get(n, n))
                s.i += 2
                continue
            out.append(s.t[s.i])
            s.i += 1
        s.i += 1
        return ''.join(out)

    def key(s):
        s.ws()
        if s.t[s.i] in '"\'':
            return s.string()
        m = re.match(r'[\w$]+', s.t[s.i:])
        s.i += m.end()
        return m.group(0)

    def obj(s):
        s.i += 1
        o = {}
        while True:
            s.ws()
            if s.t[s.i] == '}':
                s.i += 1
                return o
            k = s.key()
            s.ws()
            assert s.t[s.i] == ':', s.t[s.i - 40:s.i + 40]
            s.i += 1
            o[k] = s.val()
            s.ws()
            if s.t[s.i] == ',':
                s.i += 1

    def arr(s):
        s.i += 1
        a = []
        while True:
            s.ws()
            if s.t[s.i] == ']':
                s.i += 1
                return a
            a.append(s.val())
            s.ws()
            if s.t[s.i] == ',':
                s.i += 1


def parse(html):
    i = html.find('a.modelId=')
    p = P(html, i)
    d = {}
    while html.startswith('a.', p.i):
        p.i += 2
        m = re.match(r'[\w$]+', html[p.i:])
        k = m.group(0)
        p.i += m.end()
        if html[p.i] != '=':
            break
        p.i += 1
        d[k] = p.val()
        if html[p.i] == ';':
            p.i += 1
        else:
            break
    return d


if __name__ == '__main__':
    d = parse(open(sys.argv[1]).read())
    short = {}
    for k, v in d.items():
        j = json.dumps(v)
        short[k] = v if len(j) < 300 else j[:300] + '...'
    print(json.dumps(short, indent=1))
